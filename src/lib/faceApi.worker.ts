/**
 * FaceApi Worker — ekstraksi face descriptor 128-d DI LUAR main thread.
 *
 * Kenapa worker:
 *   Ekstraksi descriptor memakai @vladmandic/face-api + tfjs (forward-pass
 *   FaceRecognitionNet). Kalau dijalankan di main thread, inference sinkron
 *   memblokir rAF loop MediaPipe → deteksi wajah tersendat & skor lama muncul
 *   (terutama di HP low-end). Dengan worker, inference jalan di background,
 *   main thread tetap mulus menghitung pose/kedip/liveness.
 *
 * Single-detection (tidak ada detektor ulang):
 *   MediaPipe di main thread SUDAH menemukan wajah + crop. Worker TIDAK
 *   menjalankan TinyFaceDetector/FaceLandmark68 lagi — langsung hitung
 *   descriptor dari crop via faceRecognitionNet.computeFaceDescriptor().
 *   Hasilnya: 1 forward-pass per frame (bukan 3 jaringan) dan tidak ada lagi
 *   kegagalan "tidak ada wajah terdeteksi di snapshot".
 *
 * Input dikirim sebagai RAW RGBA (ArrayBuffer), BUKAN ImageBitmap/canvas:
 *   - tf.browser.fromPixels(ImageBitmap) di Web Worker rapuh — punya fallback
 *     document.createElement('canvas') yang tidak ada di worker.
 *   - tf.tensor3d(new Uint8Array(rgba), [h,w,4]) deterministik di semua backend
 *     (webgl/cpu) tanpa menyentuh DOM.
 *   - ArrayBuffer ditransfer zero-copy via transfer list; getImageData di main
 *     thread jauh lebih murah daripada createImageBitmap.
 *
 * Env face-api di-worker di-set MANUAL via env.setEnv():
 *   face-api menginisialisasi environment lewat env.initialize(), yang hanya
 *   jalan kalau isBrowser() (butuh window/document/HTMLImageElement/dll) atau
 *   isNodejs() — keduanya FALSE di Web Worker → environment null →
 *   loadFromUri → fetchOrThrow → env.getEnv() lempar "environment is not
 *   defined". SetEnv memberikan fetch untuk loadWeightMap (loadFromUri) +
 *   stub OffscreenCanvas. computeFaceDescriptor(Tensor) tidak pernah
 *   menyentuh canvas (lihat NetInput.toBatchTensor — cabang tensor murni
 *   padToSquare + resizeBilinear), jadi stub canvas tidak dipakai saat infer.
 *
 * Komunikasi:
 *   main → worker:  { type: 'init', id }
 *                   { type: 'extract', id, width, height, data }   (RGBA 1 wajah)
 *                   { type: 'extractBatch', id, items: [{width,height,data}][] }
 *   worker → main:  { type: 'init-ack' | 'init-error', id, message? }
 *                   { type: 'result', id, descriptor: number[] | null }
 *                   { type: 'batch-result', id, descriptors: (number[]|null)[] }
 *                   { type: 'worker-error', id, message }
 */

// Declare minimal worker scope — menghindari konflik lib DOM vs WebWorker
interface FaceWorkerScope {
  onmessage: ((ev: MessageEvent) => void) | null;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
}
declare const self: FaceWorkerScope;

type FaceApiModule = typeof import('@vladmandic/face-api');

interface RgbaFrame {
  width: number;
  height: number;
  data: ArrayBuffer;
}

let api: FaceApiModule | null = null;
let initPromise: Promise<FaceApiModule | null> | null = null;

/**
 * Pasang environment face-api yang kompatibel dengan Web Worker.
 * Harus dipanggil SEBELUM loadFromUri/setBackend.
 */
function installWorkerEnv(faceapi: FaceApiModule): void {
  // OffscreenCanvas/ImageData/fetch tersedia di Web Worker; window/document
  // tidak. Tipe Environment face-api menuntut constructor DOM → cast as any.
  const workerEnv = {
    Canvas: typeof OffscreenCanvas !== 'undefined' ? OffscreenCanvas : undefined,
    CanvasRenderingContext2D:
      typeof OffscreenCanvasRenderingContext2D !== 'undefined'
        ? OffscreenCanvasRenderingContext2D
        : undefined,
    Image: undefined,
    ImageData,
    Video: undefined,
    createCanvasElement: () => new OffscreenCanvas(8, 8),
    createImageElement: () => {
      throw new Error('createImageElement tidak tersedia di Web Worker');
    },
    createVideoElement: () => {
      throw new Error('createVideoElement tidak tersedia di Web Worker');
    },
    fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
    readFile: () => {
      throw new Error('readFile tidak tersedia di Web Worker');
    },
  };
  (faceapi as unknown as { env: { setEnv(e: typeof workerEnv): void } }).env.setEnv(workerEnv);
}

/**
 * Inisialisasi face-api SEKALI di worker: env → backend webgl → cpu fallback,
 * lalu load HANYA faceRecognitionNet (detektor & landmark tidak dibutuhkan
 * karena MediaPipe sudah memberi crop wajah).
 */
function ensureInited(): Promise<FaceApiModule | null> {
  if (api) return Promise.resolve(api);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const faceapi = await import('@vladmandic/face-api');
      installWorkerEnv(faceapi);
      const tf = faceapi.tf as unknown as {
        setBackend: (name: string) => Promise<boolean>;
        ready: () => Promise<void>;
      };
      try {
        await tf.setBackend('webgl');
        await tf.ready();
      } catch {
        await tf.setBackend('cpu');
        await tf.ready();
      }
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      api = faceapi;
      return faceapi;
    } catch (err) {
      console.error('[FaceApiWorker] init gagal:', err);
      return null;
    }
  })();

  return initPromise;
}

/**
 * Bangun tensor RGB [h,w,3] dari buffer RGBA (nilai 0–255, setara output
 * tf.browser.fromPixels). Kanal alpha dibuang — FaceRecognitionNet butuh 3
 * channel dan toBatchTensor memaksa as3D(...,3).
 *
 * CATATAN: typeface tfjs dari face-api hanya mengekspos FUNGSI `slice`
 * (bukan chained method `.slice()`), jadi dipakai tf.slice(t, begin, size).
 */
function rgbaToRgbTensor(
  tf: FaceApiModule['tf'],
  frame: RgbaFrame
): ReturnType<FaceApiModule['tf']['tensor3d']> {
  return tf.tidy(() => {
    const t4 = tf.tensor3d(
      new Uint8Array(frame.data, 0, frame.width * frame.height * 4),
      [frame.height, frame.width, 4]
    );
    const rgb = tf.slice(t4, [0, 0, 0], [frame.height, frame.width, 3]);
    t4.dispose();
    return rgb;
  });
}

/** Ekstrak 1 descriptor dari RGBA (single forward-pass, tanpa detektor). */
async function extractOne(frame: RgbaFrame): Promise<number[] | null> {
  const faceapi = await ensureInited();
  if (!faceapi) throw new Error('face-api belum siap di worker');

  const rgb = rgbaToRgbTensor(faceapi.tf, frame);
  try {
    const desc = (await faceapi.nets.faceRecognitionNet.computeFaceDescriptor(
      rgb
    )) as Float32Array | Float32Array[];
    const arr = Array.isArray(desc) ? desc[0] : desc;
    if (!arr) return null;
    return Array.from(arr);
  } finally {
    rgb.dispose();
  }
}

/** Ekstrak descriptor dari BANYAK RGBA sekaligus (satu forward-pass batch). */
async function extractBatch(frames: RgbaFrame[]): Promise<(number[] | null)[]> {
  const faceapi = await ensureInited();
  if (!faceapi) throw new Error('face-api belum siap di worker');

  const tensors = frames.map((f) => rgbaToRgbTensor(faceapi.tf, f));
  try {
    const descs = (await faceapi.nets.faceRecognitionNet.computeFaceDescriptor(
      tensors
    )) as Float32Array | Float32Array[];
    const list = Array.isArray(descs) ? descs : [descs];
    return list.map((d) => (d ? Array.from(d) : null));
  } finally {
    for (const t of tensors) t.dispose();
  }
}

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data;
  if (!msg || typeof msg.type !== 'string') return;

  switch (msg.type) {
    case 'init': {
      const ok = await ensureInited();
      self.postMessage(
        ok
          ? { type: 'init-ack', id: msg.id }
          : { type: 'init-error', id: msg.id, message: 'init worker face-api gagal' }
      );
      break;
    }

    case 'extract': {
      try {
        const descriptor = await extractOne(msg as RgbaFrame);
        self.postMessage({ type: 'result', id: msg.id, descriptor });
      } catch (err) {
        self.postMessage({
          type: 'worker-error',
          id: msg.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    case 'extractBatch': {
      try {
        const frames: RgbaFrame[] = Array.isArray(msg.items) ? msg.items : [];
        const descriptors = await extractBatch(frames);
        self.postMessage({ type: 'batch-result', id: msg.id, descriptors });
      } catch (err) {
        self.postMessage({
          type: 'worker-error',
          id: msg.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    default:
      break;
  }
};
