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
let loadError: string | null = null;
let loadAttempted = false;

export type ModelStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'error'; message: string };

// ── Deteksi perangkat low-end ──
// CATATAN: MediaPipe Face Landmarker hanya punya SATU model resmi
// (face_landmarker.task, sudah MobileNetV2-based + input 256×256 → cukup
// ringan). Tidak ada varian "lite" untuk face landmarker (beda dengan
// pose/hand landmarker). Jadi lever performa untuk HP low-end bukan ganti
// model, tapi: (1) kurangi frekuensi deteksi (throttle), (2) turunkan
// resolusi kamera. Fungsi ini dipakai untuk menyesuaikan throttle tsb.
//
// Heuristik: navigator.deviceMemory (RAM, hanya Chromium) + hardwareConcurrency.
const LITE_CORE_MAX = 4;    // ≤4 core CPU
const LITE_MEM_GB_MAX = 4;  // ≤4GB RAM

/** Deteksi apakah perangkat low-end → perlu deteksi lebih hemat. */
export function isLowEndDevice(): boolean {
  try {
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    if (typeof memory === 'number' && memory > 0 && memory <= LITE_MEM_GB_MAX) return true;
    const cores = navigator.hardwareConcurrency ?? 0;
    if (cores > 0 && cores <= LITE_CORE_MAX) return true;
    return false;
  } catch {
    return false;
  }
}

/** Interval deteksi wajah (ms) — lebih jarang di HP low-end. */
export function getDetectionIntervalMs(defaultMs: number): number {
  return isLowEndDevice() ? Math.round(defaultMs * 1.5) : defaultMs;
}

/** Dapatkan status model saat ini (tanpa memicu loading) */
export function getModelStatus(): ModelStatus {
  if (isLoaded) return { state: 'ready' };
  if (loadError) return { state: 'error', message: loadError };
  if (loadAttempted && !loadingPromise) return { state: 'error', message: 'Gagal memuat model' };
  if (loadingPromise) return { state: 'loading' };
  return { state: 'idle' };
}

/** Inisialisasi FaceLandmarker — singleton, GPU dulu, fallback ke CPU */
export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (instance) return instance;
  if (loadingPromise) return loadingPromise;
  loadAttempted = true;

  loadingPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
    );

    // Coba GPU dulu, fallback ke CPU kalau gagal
    const delegates = ['GPU', 'CPU'] as const;
    let lastError: unknown;

    for (const delegate of delegates) {
      try {
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate,
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        instance = landmarker;
        isLoaded = true;
        loadError = null;
        return landmarker;
      } catch (err) {
        lastError = err;
        console.warn(`[FaceLandmarker] delegate ${delegate} gagal:`, err);
      }
    }

    // Semua delegate gagal
    instance = null;
    isLoaded = false;
    loadError = `Model deteksi wajah tidak bisa dimuat di HP ini. ${lastError instanceof Error ? lastError.message : ''}`;
    loadingPromise = null; // reset biar bisa dicoba lagi nanti
    throw new Error(loadError);
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

// ═══════════════════════════════════════════════════
// Face Recognition Helpers
// ═══════════════════════════════════════════════════

const NOSE_TIP_INDEX = 1;   // landmark hidung — pusat normalisasi
const LEFT_EYE_OUTER = 33;   // ujung mata kiri
const RIGHT_EYE_OUTER = 263; // ujung mata kanan
const LANDMARK_COUNT = 478;

/**
 * L2-normalize vektor di-place (unit vector).
 * Dipakai setelah centering/scaling biar Euclidean distance antar descriptor
 * punya skala konsisten (range 0–2).
 */
function l2Normalize(vec: number[]): void {
  let sqSum = 0;
  for (let i = 0; i < vec.length; i++) sqSum += vec[i] * vec[i];
  const norm = Math.sqrt(sqSum);
  if (norm < 1e-9) return;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
}

/**
 * Ekstrak face descriptor dari 478 landmark MediaPipe.
 * Normalisasi: translate ke nose tip, scale dengan inter-eye distance,
 * lalu L2-normalize jadi unit vector agar Euclidean distance konsisten.
 * Hasil: array 1434 float (478 × 3), panjang = 1.
 */
export function extractDescriptor(
  landmarks: { x: number; y: number; z: number }[]
): number[] | null {
  if (!landmarks || landmarks.length < LANDMARK_COUNT) return null;

  const nose = landmarks[NOSE_TIP_INDEX];
  const leftEye = landmarks[LEFT_EYE_OUTER];
  const rightEye = landmarks[RIGHT_EYE_OUTER];

  // Inter-eye distance (3D Euclidean)
  const eyeDist = Math.sqrt(
    (rightEye.x - leftEye.x) ** 2 +
    (rightEye.y - leftEye.y) ** 2 +
    (rightEye.z - leftEye.z) ** 2
  );

  if (eyeDist < 0.001) return null; // wajah terlalu kecil / tidak valid

  const desc = new Array<number>(LANDMARK_COUNT * 3);
  for (let i = 0; i < LANDMARK_COUNT; i++) {
    const idx = i * 3;
    desc[idx]     = (landmarks[i].x - nose.x) / eyeDist;
    desc[idx + 1] = (landmarks[i].y - nose.y) / eyeDist;
    desc[idx + 2] = (landmarks[i].z - nose.z) / eyeDist;
  }

  // L2-normalize jadi unit vector agar skor Euclidean konsisten
  l2Normalize(desc);

  return desc;
}

/**
 * Hitung Euclidean distance antara dua descriptor.
 * Sebelum dihitung, kedua descriptor di-L2-normalize dulu (jaga-jaga
 * kalau ada descriptor lawas yang belum ternormalisasi di database).
 * Makin kecil → makin mirip. Range: 0 (identik) – 2 (berlawanan).
 */
export function matchDescriptor(
  desc1: number[],
  desc2: number[]
): number {
  if (desc1.length !== desc2.length || desc1.length === 0) return Infinity;

  // Normalize kedua descriptor (safe untuk yg sudah ternormalisasi)
  const a = desc1.slice();
  const b = desc2.slice();
  l2Normalize(a);
  l2Normalize(b);

  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

/**
 * Ambil rata-rata dari beberapa frame descriptor (untuk enrollment multi-frame).
 */
export function averageDescriptors(descriptors: number[][]): number[] | null {
  if (descriptors.length === 0) return null;
  const len = descriptors[0].length;
  const avg = new Array<number>(len).fill(0);

  for (const desc of descriptors) {
    for (let i = 0; i < len; i++) {
      avg[i] += desc[i];
    }
  }

  for (let i = 0; i < len; i++) {
    avg[i] /= descriptors.length;
  }

  return avg;
}

/**
 * ⚠️ LEGACY — TIDAK DIPAKAI LAGI.
 *
 * Sejak upgrade ke @vladmandic/face-api (faceApi.ts), verifikasi wajah
 * memakai descriptor 128-d yang dilatih khusus untuk face recognition.
 * Fungsi-fungsi di bawah (extractDescriptor / matchDescriptorXY /
 * averageDescriptors / FACE_MATCH_THRESHOLD) dipertahankan hanya sebagai
 * referensi & backfill data lama — HANYA dipakai untuk MIGRASI data.
 *
 * Threshold Euclidean distance untuk face matching (legacy).
 * Setelah descriptor di-L2-normalize (unit vector, range 0–2):
 *   - 0.0–0.4 : wajah sama, ekspresi mirip
 *   - 0.4–0.6 : wajah sama, ekspresi/pose beda (masih wajar)
 *   - 0.6–0.8 : kemungkinan beda orang
 *   - > 0.8   : pasti beda orang
 * Nilai bisa disesuaikan setelah uji coba lapangan.
 */
export const FACE_MATCH_THRESHOLD = 0.15;

/**
 * Match descriptor dengan HANYA komponen x,y (buang z).
 *
 * Masalah: z dari MediaPipe adalah estimasi depth yang nilainya hampir sama
 * untuk semua orang dengan pose menghadap kamera. Ini bikin 478 dimensi
 * (dari total 1434) nyaris identik antar individu → skor semua orang mirip.
 *
 * Dengan hanya pakai x,y (956 dimensi), diskriminasi antar wajah jauh lebih baik.
 * Range skor: 0 (identik) – ~2 (berlawanan).
 * Keputusan "cocok/tidak" memakai FACE_MATCH_THRESHOLD (0.15) yang sama.
 */
export function matchDescriptorXY(
  desc1: number[],
  desc2: number[]
): number {
  if (desc1.length !== desc2.length || desc1.length === 0) return Infinity;

  const STEP = 3; // data format: [x, y, z, x, y, z, ...]

  // Ekstrak x,y aja dari kedua descriptor
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < desc1.length; i += STEP) {
    a.push(desc1[i], desc1[i + 1]);
    b.push(desc2[i], desc2[i + 1]);
  }

  l2Normalize(a);
  l2Normalize(b);

  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

// ═══════════════════════════════════════════════════
// Head Pose Estimation — anti-spoofing & guided enrollment
// ═══════════════════════════════════════════════════

export interface HeadPose {
  yaw: number;   // -1 (kiri) s.d. 1 (kanan), ~0 = lurus
  pitch: number; // -1 (bawah) s.d. 1 (atas),  ~0 = lurus
}

/**
 * Estimasi orientasi kepala dari 478 landmark MediaPipe.
 *
 * Yaw:
 *   Bandingkan jarak hidung ke sisi kiri vs kanan gambar.
 *   Deteksi mirror/non-mirror dari posisi rahang, lalu sesuaikan arah.
 *   Tengok kanan → hidung mendekat ke kanan gambar → yaw positif
 *   Tengok kiri  → hidung mendekat ke kiri gambar  → yaw negatif
 *
 * Pitch:
 *   Bandingkan posisi hidung terhadap titik tengah mata-mulut.
 *   Lurus     → nose.y ≈ refMidY → pitch ≈ 0
 *   Mendongak → hidung naik      → pitch positif
 *   Menunduk   → hidung turun    → pitch negatif
 */
export function estimateHeadPose(
  landmarks: { x: number; y: number; z: number }[]
): HeadPose {
  if (!landmarks || landmarks.length < 17) return { yaw: 0, pitch: 0 };

  const nose = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const mouth = landmarks[13];
  const leftJaw = landmarks[172];   // jaw corner kiri (lebar wajah)
  const rightJaw = landmarks[397];  // jaw corner kanan (lebar wajah)

  const faceWidth = Math.abs(rightJaw.x - leftJaw.x);
  const faceHeight = Math.abs(mouth.y - (leftEye.y + rightEye.y) / 2);

  // ── Yaw ──
  // Bandingkan jarak hidung ke rahang kiri vs kanan.
  // Cari dulu landmark mana yang ada di kiri gambar dan mana di kanan.
  // Lalu deteksi mirror/non-mirror: di feed non-mirror, leftJaw ada di
  // kanan gambar (x lebih besar); di feed mirror, leftJaw ada di kiri.
  //   Tengok kanan → hidung mendekat ke rahang kanan → yaw positif
  //   Tengok kiri  → hidung mendekat ke rahang kiri  → yaw negatif
  let yaw = 0;
  if (faceWidth > 0.01) {
    const mirror = leftJaw.x < rightJaw.x; // true = feed mirror
    const leftSide = mirror ? leftJaw.x : rightJaw.x;  // sisi kiri gambar
    const rightSide = mirror ? rightJaw.x : leftJaw.x; // sisi kanan gambar
    const imgFaceWidth = rightSide - leftSide;

    const distToLeftSide = nose.x - leftSide;   // jarak hidung ke sisi kiri
    const distToRightSide = rightSide - nose.x;  // jarak hidung ke sisi kanan

    yaw = (mirror ? -1 : 1) * (distToLeftSide - distToRightSide) / imgFaceWidth;
    yaw = Math.max(-1, Math.min(1, yaw));
  }

  // ── Pitch ──
  // Posisi nose.y relatif terhadap titik tengah antara mata & mulut
  // (= face-relative, bukan image center).  Saat lurus nose.y ≈ refMidY.
  //   Mendongak → hidung naik (nose.y ↓) → pitch positif
  //   Menunduk  → hidung turun (nose.y ↑) → pitch negatif
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const refMidY = (eyeMidY + mouth.y) / 2; // titik tengah mata-mulut
  const pitch = faceHeight > 0.01
    ? Math.max(-1, Math.min(1, ((refMidY - nose.y) * 4) / faceHeight))
    : 0;

  return { yaw, pitch };
}

/**
 * Deteksi apakah user sedang menutup mata (blink).
 * Threshold default 0.3 (enrollment), bisa diperketat via argumen
 * (misal 0.45 untuk liveness challenge biar tidak mudah false-positive).
 */
export function isBlinking(
  blendshapes: { categoryName: string; score: number }[],
  threshold: number = 0.30
): boolean {
  const leftBlink = blendshapes.find(s => s.categoryName === 'eyeBlinkLeft')?.score ?? 0;
  const rightBlink = blendshapes.find(s => s.categoryName === 'eyeBlinkRight')?.score ?? 0;
  return leftBlink > threshold && rightBlink > threshold;
}

// ── Pose detection thresholds (untuk FaceEnrollment) ──
// Dinaikkan dari 0.10/0.10 karena threshold sekecil itu membuat pose langsung
// "tertangkap" padahal wajah hampir tidak bergerak (atau cuma noise 1 frame).
// Sekarang butuh gerakan yang JELAS supaya wajah sempat terbaca penuh saat
// menoleh/mendongak (bukan kedutan sekejap).
export const POSE_YAW_THRESHOLD = 0.30;
export const POSE_PITCH_THRESHOLD = 0.25;