
/**
 * Face API wrapper — face verification berbasis @vladmandic/face-api
 * (FaceRecognitionNet, descriptor 128-d yang DILATIH khusus untuk face
 * recognition — bukan landmark mentah).
 *
 * Kenapa ganti dari MediaPipe landmark descriptor (sebelumnya di
 * faceLandmarker.ts):
 *   Descriptor landmark + normalisasi geometri sederhana (translate ke hidung,
 *   scale inter-eye, L2) TIDAK diskriminatif — dua wajah berbeda bisa
 *   menghasilkan skor jarak yang hampir sama dengan wajah asli (skor hijau
 *   palsu). FaceRecognitionNet menghasilkan embedding yang dilatih untuk
 *   memaksimalkan jarak antar orang berbeda → verifikasi jauh lebih andal.
 *
 * Arsitektur:
 *   - MediaPipe FaceLandmarker TETAP dipakai untuk deteksi + liveness +
 *     head-pose (anti-spoofing) di CameraAbsen/FaceEnrollment.
 *   - Modul ini HANYA menangani ekstraksi descriptor & matching.
 *
 * Performa (v2 — worker + single-detection):
 *   - Ekstraksi descriptor dijalankan di WEB WORKER (faceApi.worker.ts),
 *     sehingga inference tfjs tidak memblokir rAF loop MediaPipe di main
 *     thread (dulu skor lama muncul di HP low-end karena main thread hang).
 *   - Deteksi wajah TIDAK diulang oleh face-api — MediaPipe sudah memberi
 *     crop wajah. Worker langsung menghitung descriptor via
 *     faceRecognitionNet.computeFaceDescriptor() (1 forward-pass, bukan
 *     detektor+landmark+recognition seperti sebelumnya). Tidak ada lagi
 *     kegagalan "tidak ada wajah terdeteksi di snapshot".
 *   - Fallback inline otomatis kalau Worker tidak tersedia atau init worker
 *     gagal (tetap single-detection, hanya tidak offload).
 *
 * Skor matching = Euclidean distance 128-d:
 *   - ~0.0–0.4 : wajah sama
 *   - 0.4–0.5  : kemungkinan wajah sama (batas)
 *   - > 0.5    : wajah berbeda
 * Threshold diperketat dari 0.6 → 0.5 atas permintaan admin
 * (verifikasi lebih ketat, skor hijau hanya untuk kemiripan tinggi).
 */

// Dynamic import agar tfjs (~2MB) tidak ikut bundle awal (di-bundle ke
// chunk worker terpisah oleh Vite).
type FaceApiModule = typeof import('@vladmandic/face-api');

import { setFaceApiStatus } from './modelLoading';
import { logFace, warnFace, errorFace } from './faceDebug';

/** Threshold Euclidean distance — ≤ 0.5 dianggap wajah sama. */
export const FACE_MATCH_DISTANCE = 0.5;

// ═══════════════════════════════════════════════════
// Backend strategy: worker (default) → inline fallback
// ═══════════════════════════════════════════════════

type BackendMode = 'idle' | 'worker' | 'inline';

let mode: BackendMode = 'idle';
let initError: string | null = null;

// State worker
let worker: Worker | null = null;
let workerInitPromise: Promise<void> | null = null;
let workerInitId: number | null = null;

// State inline fallback (main thread)
let inlineApi: FaceApiModule | null = null;
let inlineInitPromise: Promise<FaceApiModule> | null = null;

// Plumbing request → response (worker pakai id integer)
interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}
const pendingRequests = new Map<number, Pending>();
let requestSeq = 0;

function nextRequestId(): number {
  return ++requestSeq;
}

/** Browser punya Worker? (jalur worker — input dikirim sebagai RGBA) */
function supportsWorkerPath(): boolean {
  return typeof Worker !== 'undefined';
}

function handleWorkerMessage(ev: MessageEvent): void {
  const msg = ev.data;
  if (!msg || typeof msg.type !== 'string') return;

  const p = typeof msg.id === 'number' ? pendingRequests.get(msg.id) : undefined;

  switch (msg.type) {
    case 'init-ack':
      if (p) {
        pendingRequests.delete(msg.id);
        p.resolve(null);
      }
      break;
    case 'init-error':
      if (p) {
        pendingRequests.delete(msg.id);
        p.reject(new Error(msg.message || 'init worker face-api gagal'));
      }
      break;
    case 'result':
      if (p) {
        pendingRequests.delete(msg.id);
        p.resolve(msg.descriptor ?? null);
      }
      break;
    case 'batch-result':
      if (p) {
        pendingRequests.delete(msg.id);
        p.resolve(Array.isArray(msg.descriptors) ? msg.descriptors : []);
      }
      break;
    case 'worker-error':
      if (p) {
        pendingRequests.delete(msg.id);
        p.reject(new Error(msg.message || 'error di worker face-api'));
      }
      break;
    default:
      break;
  }
}

/** Inisialisasi worker: buat Worker + tunggu ack init (model selesai download). */
function initWorker(): Promise<void> {
  if (workerInitPromise) return workerInitPromise;

  setFaceApiStatus({ state: 'loading' });
  logFace('faceApi', 'init dimulai — worker face-api (mengunduh tfjs + model recognition ~5MB)');

  workerInitPromise = (async () => {
    try {
      const w = new Worker(new URL('./faceApi.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker = w;
      w.onmessage = handleWorkerMessage;

      const id = nextRequestId();
      workerInitId = id;
      const ack = new Promise<void>((resolve, reject) => {
        pendingRequests.set(id, { resolve: () => resolve(), reject });
      });
      w.onerror = (ev) => {
        const msg = ev.message || 'Worker face-api error';
        initError = msg;
        setFaceApiStatus({ state: 'error', message: msg });
        errorFace('faceApi', 'worker error', msg);
        // Reject ack segera supaya fallback inline langsung jalan
        // (tidak nunggu timeout 30 detik).
        if (workerInitId !== null) {
          const p = pendingRequests.get(workerInitId);
          if (p) {
            pendingRequests.delete(workerInitId);
            p.reject(new Error(msg));
          }
        }
      };
      w.postMessage({ type: 'init', id });

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout init worker face-api (30s)')), 30000)
      );

      await Promise.race([ack, timeout]);
      mode = 'worker';
      initError = null;
      setFaceApiStatus({ state: 'ready' });
      logFace('faceApi', 'worker face-api SIAP');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      initError = msg;
      worker?.terminate();
      worker = null;
      workerInitPromise = null;
      throw new Error(msg);
    }
  })();

  return workerInitPromise;
}

/** Inisialisasi inline (main thread) — fallback jika worker tidak jalan. */
function getInlineApi(): Promise<FaceApiModule> {
  if (inlineApi) return Promise.resolve(inlineApi);
  if (inlineInitPromise) return inlineInitPromise;

  setFaceApiStatus({ state: 'loading' });
  logFace('faceApi', 'init inline dimulai — load faceRecognitionNet');

  inlineInitPromise = (async () => {
    const faceapi = await import('@vladmandic/face-api');
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
    inlineApi = faceapi;
    initError = null;
    setFaceApiStatus({ state: 'ready' });
    logFace('faceApi', 'face-api inline SIAP');
    return faceapi;
  })();

  return inlineInitPromise;
}

async function initInline(): Promise<void> {
  mode = 'inline';
  initError = null;
  try {
    await getInlineApi();
  } catch (err) {
    initError = err instanceof Error ? err.message : String(err);
    setFaceApiStatus({ state: 'error', message: initError });
    errorFace('faceApi', 'init inline gagal', initError);
    throw new Error(initError);
  }
}

/**
 * Inisialisasi face-api (worker dulu, fallback inline).
 * Dipanggil sekali; pemanggil hanya perlu await (return value tidak dipakai).
 */
export async function initFaceApi(): Promise<void> {
  if (mode !== 'idle') {
    if (mode === 'worker') await workerInitPromise;
    else await inlineInitPromise;
    if (initError) throw new Error(initError);
    return;
  }

  if (supportsWorkerPath()) {
    try {
      await initWorker();
      if (initError) throw new Error(initError);
      return;
    } catch (err) {
      warnFace('faceApi', 'worker gagal — fallback inline', String(err));
    }
  }

  await initInline();
}

/** Cek apakah face-api sudah siap dipakai. */
export function isFaceApiReady(): boolean {
  if (mode === 'worker' && worker) return true;
  if (mode === 'inline' && inlineApi) return true;
  return false;
}

/** Status inisialisasi (untuk UI). */
export function getFaceApiStatus():
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'error'; message: string } {
  if (isFaceApiReady()) return { state: 'ready' };
  if (initError) return { state: 'error', message: initError };
  if (workerInitPromise || inlineInitPromise) return { state: 'loading' };
  return { state: 'idle' };
}

// ═══════════════════════════════════════════════════
// Ekstraksi descriptor — worker path + inline fallback
// ═══════════════════════════════════════════════════

/**
 * Baca pixel RGBA dari crop wajah (canvas/video) untuk dikirim ke worker.
 * Data = ArrayBuffer RGBA (zero-copy transfer). Worker membangun tensor
 * sendiri — menghindari ImageBitmap/fromPixels yang rapuh di Web Worker.
 * Returns null kalau input tidak punya pixel valid.
 */
function canvasToRgba(
  input: HTMLVideoElement | HTMLCanvasElement
): { width: number; height: number; data: ArrayBuffer } | null {
  let source: HTMLCanvasElement;
  if (input instanceof HTMLVideoElement) {
    const w = input.videoWidth;
    const h = input.videoHeight;
    if (!w || !h) return null;
    source = document.createElement('canvas');
    source.width = w;
    source.height = h;
    const dctx = source.getContext('2d');
    if (!dctx) return null;
    dctx.drawImage(input, 0, 0, w, h);
  } else {
    source = input;
  }

  const ctx = source.getContext('2d');
  if (!ctx) return null;
  const img = ctx.getImageData(0, 0, source.width, source.height);
  return { width: source.width, height: source.height, data: img.data.buffer };
}

/** Jalur inline: 1 forward-pass FaceRecognitionNet langsung dari input. */
async function extractInline(
  input: HTMLVideoElement | HTMLCanvasElement
): Promise<number[] | null> {
  const faceapi = await getInlineApi();
  const desc = (await faceapi.nets.faceRecognitionNet.computeFaceDescriptor(
    input
  )) as Float32Array | Float32Array[];
  const arr = Array.isArray(desc) ? desc[0] : desc;
  if (!arr) return null;
  logFace('faceApi', 'extractInline sukses (descriptor 128-d)', { dim: arr.length });
  return Array.from(arr);
}

async function extractInlineBatch(
  inputs: (HTMLVideoElement | HTMLCanvasElement)[]
): Promise<(number[] | null)[]> {
  const out: (number[] | null)[] = [];
  for (const inp of inputs) {
    try {
      out.push(await extractInline(inp));
    } catch (err) {
      warnFace('faceApi', 'extractInline gagal untuk 1 frame', String(err));
      out.push(null);
    }
  }
  return out;
}

/**
 * Ekstrak face descriptor (128-d) dari video/canvas crop wajah.
 * Returns null jika tidak ada wajah (jarang terjadi — input adalah crop yang
 * sudah diketahui ada wajahnya oleh MediaPipe).
 *
 * CATATAN: async + berat — panggil dengan throttle, JANGAN tiap frame.
 * Panggilan bersamaan di-guard oleh pemanggil (lihat liveDescBuffer di
 * CameraAbsen / frontalBuffer di FaceEnrollment).
 */
export async function extractFaceDescriptor(
  input: HTMLVideoElement | HTMLCanvasElement
): Promise<number[] | null> {
  await initFaceApi();

  if (mode === 'worker' && worker) {
    const rgba = canvasToRgba(input);
    if (!rgba) {
      warnFace('faceApi', 'canvasToRgba gagal — fallback inline');
      return extractInline(input);
    }
    try {
      const id = nextRequestId();
      const result = new Promise<number[] | null>((resolve, reject) => {
        pendingRequests.set(id, {
          resolve: (v) => resolve(v as number[] | null),
          reject,
        });
      });
      worker.postMessage({ type: 'extract', id, ...rgba }, [rgba.data]);
      const value = await result;
      if (value === null) {
        warnFace('faceApi', 'extractFaceDescriptor: tidak ada wajah (worker)');
      } else {
        logFace('faceApi', 'extractFaceDescriptor sukses (descriptor 128-d)', {
          dim: value.length,
        });
      }
      return value;
    } catch (err) {
      // Worker mati/gagal saat eksekusi → coba inline sekali
      warnFace('faceApi', 'worker extract gagal — fallback inline', String(err));
      return extractInline(input);
    }
  }

  return extractInline(input);
}

/**
 * Ekstrak descriptor dari BANYAK crop sekaligus (satu round-trip ke worker).
 * Dipakai finishLiveness untuk memproses seluruh buffer snapshot frontal.
 * Returns array dengan posisi sama dengan input (null = frame gagal).
 */
export async function extractFaceDescriptorsBatch(
  inputs: (HTMLVideoElement | HTMLCanvasElement)[]
): Promise<(number[] | null)[]> {
  if (inputs.length === 0) return [];
  await initFaceApi();

  if (mode === 'worker' && worker) {
    const items: { width: number; height: number; data: ArrayBuffer }[] = [];
    const transfers: ArrayBuffer[] = [];
    for (const inp of inputs) {
      const rgba = canvasToRgba(inp);
      if (rgba) {
        items.push(rgba);
        transfers.push(rgba.data);
      }
    }
    if (items.length === 0) {
      warnFace('faceApi', 'canvasToRgba batch kosong — fallback inline');
      return extractInlineBatch(inputs);
    }
    try {
      const id = nextRequestId();
      const result = new Promise<(number[] | null)[]>((resolve, reject) => {
        pendingRequests.set(id, {
          resolve: (v) => resolve(v as (number[] | null)[]),
          reject,
        });
      });
      worker.postMessage({ type: 'extractBatch', id, items }, transfers);
      return await result;
    } catch (err) {
      warnFace('faceApi', 'worker batch gagal — fallback inline', String(err));
      return extractInlineBatch(inputs);
    }
  }

  return extractInlineBatch(inputs);
}

// ═══════════════════════════════════════════════════
// Matching & averaging
// ═══════════════════════════════════════════════════

/**
 * Jarak Euclidean antara dua descriptor 128-d.
 * Kecil = mirip. ≤ FACE_MATCH_DISTANCE (0.5) = wajah sama.
 */
export function matchFaceDistance(
  d1: number[] | Float32Array,
  d2: number[] | Float32Array
): number {
  let sumSq = 0;
  for (let i = 0; i < d1.length; i++) {
    const diff = d1[i] - d2[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

/**
 * Rata-rata beberapa descriptor 128-d (untuk enrollment multi-frame).
 * Descriptor hasil rata-rata TIDAK perlu dinormalisasi ulang — face-api
 * euclidean distance bekerja pada raw descriptor 128-d.
 */
export function averageDescriptors(descriptors: number[][]): number[] | null {
  if (descriptors.length === 0) return null;
  const len = descriptors[0].length;
  const avg = new Array<number>(len).fill(0);
  for (const desc of descriptors) {
    for (let i = 0; i < len; i++) avg[i] += desc[i];
  }
  for (let i = 0; i < len; i++) avg[i] /= descriptors.length;
  return avg;
}

// ═══════════════════════════════════════════════════
// Crop wajah + eye-roll alignment
// ═══════════════════════════════════════════════════

const LEFT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 133;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;

/**
 * Hitung kemiringan kepala (roll, radian) dari posisi kedua mata MediaPipe.
 * Mata kiri = titik tengah (33,133), mata kanan = titik tengah (362,263).
 * Returns null kalau landmark mata tidak lengkap.
 */
function computeEyeRoll(landmarks: { x: number; y: number }[]): number | null {
  if (!landmarks || landmarks.length <= RIGHT_EYE_OUTER) return null;
  const lx = (landmarks[LEFT_EYE_OUTER].x + landmarks[LEFT_EYE_INNER].x) / 2;
  const ly = (landmarks[LEFT_EYE_OUTER].y + landmarks[LEFT_EYE_INNER].y) / 2;
  const rx = (landmarks[RIGHT_EYE_OUTER].x + landmarks[RIGHT_EYE_INNER].x) / 2;
  const ry = (landmarks[RIGHT_EYE_OUTER].y + landmarks[RIGHT_EYE_INNER].y) / 2;
  const dx = rx - lx;
  const dy = ry - ly;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;
  return Math.atan2(dy, dx);
}

/**
 * Crop wajah dari frame video menjadi canvas kecil (224×224) berbasis
 * bounding box landmark MediaPipe. Output dipakai sebagai input ekstraksi
 * descriptor face-api — crop memperkecil input sehingga inference lebih
 * cepat & akurat.
 *
 * Eye-roll alignment: crop di-rotasi supaya garis mata mendatar (meniru
 * "aligned rect" face-api). Karena ekstraksi descriptor sekarang langsung
 * dari crop (tanpa detektor face-api yang biasa menormalkan rotasi), rotasi
 * ini menjaga akurasi match untuk kepala yang agak miring. Dipakai konsisten
 * untuk enrollment & live → template dan skor tetap sebanding.
 *
 * Returns null kalau video/bounding box tidak valid.
 */
export function captureFaceSnapshot(
  video: HTMLVideoElement,
  landmarks: { x: number; y: number }[],
  size = 224
): HTMLCanvasElement | null {
  if (!video.videoWidth || !video.videoHeight || !landmarks || landmarks.length === 0) {
    return null;
  }
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }
  if (maxX - minX < 0.05 || maxY - minY < 0.05) return null; // wajah terlalu kecil

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  // Padding di sekitar wajah (normalized terhadap ukuran wajah)
  const PAD = 0.25;
  const faceW = (maxX - minX) * vw;
  const faceH = (maxY - minY) * vh;
  const padX = faceW * PAD;
  const padY = faceH * PAD;

  const sx = Math.max(0, minX * vw - padX);
  const sy = Math.max(0, minY * vh - padY);
  const sw = Math.min(vw - sx, faceW + padX * 2);
  const sh = Math.min(vh - sy, faceH + padY * 2);
  if (sw <= 0 || sh <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // ── Eye-roll alignment ──
  const roll = computeEyeRoll(landmarks);
  if (roll === null || Math.abs(roll) < 0.02) {
    // Landmark mata tidak lengkap / kepala hampir tegak → draw polos (perilaku lama)
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
    return canvas;
  }

  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);
  // Source rect dilebarkan supaya hasil rotasi tidak memotong wajah
  const rotW = Math.abs(sw * cosR) + Math.abs(sh * sinR);
  const rotH = Math.abs(sw * sinR) + Math.abs(sh * cosR);
  const rSx = Math.max(0, cx - rotW / 2);
  const rSy = Math.max(0, cy - rotH / 2);
  const rSw = Math.min(vw - rSx, rotW);
  const rSh = Math.min(vh - rSy, rotH);
  if (rSw <= 0 || rSh <= 0) {
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
    return canvas;
  }

  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-roll);
  ctx.drawImage(video, rSx, rSy, rSw, rSh, -size / 2, -size / 2, size, size);
  ctx.restore();
  return canvas;
}
