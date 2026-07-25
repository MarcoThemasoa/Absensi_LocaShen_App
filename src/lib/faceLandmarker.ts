/**
 * Singleton FaceLandmarker — model hanya di-download SATU KALI per session.
 *
 * Sebelumnya: model di-download setiap kali komponen CameraAbsen mount
 * (useEffect dengan [] deps). User navigasi ke kamera → download ~10MB,
 * navigasi lagi → download ulang.
 *
 * Sekarang: model di-download saat pertama kali dibutuhkan, lalu di-cache
 * di module-level. Kunjungan kedua ke halaman kamera = 0 bytes download.
 *
 * Preload juga bisa dipicu lebih awal (dari AuthContext) agar model sudah
 * siap saat user masuk ke halaman kamera.
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let instance: FaceLandmarker | null = null;
let loadingPromise: Promise<FaceLandmarker> | null = null;
let isLoaded = false;

/** Inisialisasi FaceLandmarker — singleton, hanya jalan sekali */
export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (instance) return instance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm',
    );
    const landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      outputFaceBlendshapes: true,
      runningMode: 'VIDEO',
      numFaces: 1,
    });
    instance = landmarker;
    isLoaded = true;
    return landmarker;
  })();

  return loadingPromise;
}

/** Trigger preload — panggil lebih awal (misal dari AuthContext) */
export function preloadFaceLandmarker(): void {
  // Mulai loading di background tanpa await
  getFaceLandmarker().catch((err) =>
    console.error('[preloadFaceLandmarker] Gagal:', err),
  );
}

/** Cek apakah model sudah siap */
export function isFaceLandmarkerReady(): boolean {
  return isLoaded;
}

/** Reset instance (untuk testing) */
export function resetFaceLandmarker(): void {
  instance = null;
  loadingPromise = null;
  isLoaded = false;
}