/**
 * Store status loading model wajah — singleton pub/sub.
 *
 * Menyatukan status dua model (MediaPipe FaceLandmarker + face-api) menjadi
 * satu sumber kebenaran agar UI global (ModelLoadingIndicator) bisa menampilkan
 * indikator download di semua halaman, termasuk sebelum user masuk ke kamera.
 *
 * Sumber status:
 *   - faceLandmarker.ts → getModelStatus()
 *   - faceApi.ts        → getFaceApiStatus()
 * Kedua modul memanggil `notifyModelStatusChanged()` tiap ada transisi
 * (idle → loading → ready/error).
 */

import { useEffect, useState } from 'react';

export type ModelStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'error'; message: string };

export interface ModelLoadingSnapshot {
  landmarker: ModelStatus;
  faceApi: ModelStatus;
}

const listeners = new Set<() => void>();

let landmarkerStatus: ModelStatus = { state: 'idle' };
let faceApiStatus: ModelStatus = { state: 'idle' };

function emit(): void {
  for (const l of listeners) l();
}

/** Dipanggil oleh faceLandmarker.ts setiap status berubah. */
export function setLandmarkerStatus(status: ModelStatus): void {
  landmarkerStatus = status;
  emit();
}

/** Dipanggil oleh faceApi.ts setiap status berubah. */
export function setFaceApiStatus(status: ModelStatus): void {
  faceApiStatus = status;
  emit();
}

/** Dapatkan snapshot status saat ini. */
export function getModelLoadingSnapshot(): ModelLoadingSnapshot {
  return { landmarker: landmarkerStatus, faceApi: faceApiStatus };
}

/** Subscribe perubahan status; return unsubscribe. */
export function subscribeModelLoading(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Label pendek + estimasi ukuran download per model. */
export function describeModel(snapshot: ModelLoadingSnapshot): string | null {
  if (snapshot.landmarker.state === 'loading') {
    return 'Mengunduh Model Deteksi Wajah (~15MB)…';
  }
  if (snapshot.faceApi.state === 'loading') {
    return 'Mengunduh AI Pengenalan Wajah (~5MB)…';
  }
  return null;
}

/**
 * Hook React — re-render otomatis saat status model berubah.
 * Dapat dipakai di komponen apa pun (indikator global, halaman kamera, dll).
 */
export function useModelLoading(): ModelLoadingSnapshot {
  const [snapshot, setSnapshot] = useState<ModelLoadingSnapshot>(
    getModelLoadingSnapshot
  );

  useEffect(() => {
    const unsubscribe = subscribeModelLoading(() => {
      setSnapshot(getModelLoadingSnapshot());
    });
    return unsubscribe;
  }, []);

  return snapshot;
}
