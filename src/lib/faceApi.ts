
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
 * Catatan performa:
 *   - face-api + tfjs di-dynamic-import → chunk terpisah, tidak membebani
 *     bundle halaman utama.
 *   - Ekstraksi descriptor bersifat async — pemanggil harus throttle
 *     (jangan tiap frame) dan guard anti-overlap.
 *
 * Skor matching = Euclidean distance 128-d:
 *   - ~0.0–0.4 : wajah sama
 *   - 0.4–0.6  : kemungkinan wajah sama (batas)
 *   - > 0.6    : wajah berbeda
 * Threshold standar face-api / dlib: 0.6.
 */

// Dynamic import agar tfjs (~2MB) tidak ikut bundle awal.
type FaceApiModule = typeof import('@vladmandic/face-api');

let api: FaceApiModule | null = null;
let initPromise: Promise<FaceApiModule> | null = null;
let initError: string | null = null;

/** Threshold Euclidean distance — ≤ 0.6 dianggap wajah sama. */
export const FACE_MATCH_DISTANCE = 0.6;

/**
 * Inisialisasi face-api sekali (singleton): set backend + load 3 model
 * (tiny face detector, landmark 68, face recognition 128-d).
 * Model di-serve dari /models (folder public).
 */
export async function initFaceApi(): Promise<FaceApiModule> {
  if (api) return api;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const faceapi = await import('@vladmandic/face-api');

    // Coba WebGL dulu; fallback ke cpu kalau backend WebGL tidak tersedia.
    // tfjs bundled face-api tidak mengekspos typing setBackend/ready → cast.
    const tf = faceapi.tf as unknown as {
      setBackend: (name: string) => Promise<boolean>;
      ready: () => Promise<void>;
    };
    let backendOk = false;
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      backendOk = true;
    } catch {
      try {
        await tf.setBackend('cpu');
        await tf.ready();
        backendOk = true;
      } catch (err) {
        initError = `Backend face-api tidak bisa dijalankan: ${err instanceof Error ? err.message : String(err)}`;
        throw new Error(initError);
      }
    }
    void backendOk;

    const MODEL_URL = '/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    api = faceapi;
    initError = null;
    return faceapi;
  })();

  return initPromise;
}

/** Cek apakah face-api sudah siap dipakai. */
export function isFaceApiReady(): boolean {
  return api !== null;
}

/** Status inisialisasi (untuk UI). */
export function getFaceApiStatus():
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'error'; message: string } {
  if (api) return { state: 'ready' };
  if (initError) return { state: 'error', message: initError };
  if (initPromise) return { state: 'loading' };
  return { state: 'idle' };
}

/**
 * Ekstrak face descriptor (128-d Float32Array → number[]) dari video/canvas.
 * Returns null jika tidak ada wajah terdeteksi.
 *
 * CATATAN: async + berat — panggil dengan throttle, JANGAN tiap frame.
 * Panggilan bersamaan di-guard oleh pemanggil (lihat liveDescBuffer di
 * CameraAbsen / frontalBuffer di FaceEnrollment).
 */
export async function extractFaceDescriptor(
  input: HTMLVideoElement | HTMLCanvasElement
): Promise<number[] | null> {
  const faceapi = await initFaceApi();

  const result = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  return result ? Array.from(result.descriptor) : null;
}

/**
 * Jarak Euclidean antara dua descriptor 128-d.
 * Kecil = mirip. ≤ FACE_MATCH_DISTANCE (0.6) = wajah sama.
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

/**
 * Crop wajah dari frame video menjadi canvas kecil (224×224) berbasis
 * bounding box landmark MediaPipe. Output dipakai sebagai input ekstraksi
 * descriptor face-api — crop memperkecil input sehingga inference lebih
 * cepat & akurat.
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
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
  return canvas;
}
