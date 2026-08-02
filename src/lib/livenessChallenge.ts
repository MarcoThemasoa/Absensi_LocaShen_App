/**
 * Liveness Challenge — anti-spoofing untuk mencegah absen pakai video/foto teman.
 *
 * Masalah lama:
 *   Cek kedip statis (CameraAbsen) bisa dibobol — teman cukup memutar VIDEO
 *   wajah karyawan yang sedang berkedip, sistem tidak tahu bedanya.
 *
 * Solusi:
 *   Urutan challenge acak yang HARUS dijawab secara berurutan dalam batas waktu.
 *   Video pre-recorded tidak bisa menjawab karena urutannya ditentukan per-sesi
 *   (2–3 pose acak dari pool). Sistem mengecek pose/kedip langsung dari landmark
 *   real-time MediaPipe, bukan dari foto statis.
 *
 * Anti over-sensitif (v2):
 *   Threshold pose enrollment (0.10) terlalu kecil untuk liveness — gerakan
 *   kecil/kedutan langsung lolos. Liveness pakai threshold LEBIH TEGAS + syarat
 *   "tahan pose" (pose harus dipertahankan beberapa ratus ms, kecuali kedip
 *   yang memang instan). Ini juga bikin video replay makin sulit.
 *
 * Desain:
 *   - Pool 5 gesture: tengok kanan/kiri, lihat atas/bawah, kedip.
 *   - `generateChallenges()` → acak 3 pose dengan crypto (bukan Math.random,
 *     biar tidak bisa ditebak/di-replay).
 *   - `holdMs` per pose: berapa lama pose harus ditahan sebelum dianggap sah.
 *   - Timeout per pose → kalau lewat, sesi dianggap GAGAL → absen tetap dicatat
 *     tapi ditandai `is_suspicious`.
 */

import {
  estimateHeadPose,
  isBlinking,
} from './faceLandmarker';
import type { HeadPose } from './faceLandmarker';

export type ChallengeId = 'kanan' | 'kiri' | 'atas' | 'bawah' | 'kedip';

export interface ChallengeDef {
  id: ChallengeId;
  label: string; // instruksi singkat untuk UI
  hint: string;  // bantuan tambahan
  /** Berapa ms pose harus dipertahankan sebelum dianggap sah (0 = instan). */
  holdMs: number;
  check: (
    pose: HeadPose,
    blendshapes: { categoryName: string; score: number }[]
  ) => boolean;
}

/**
 * Status kedip untuk challenge 'kedip' — harus berupa SIKLUS PENUH:
 *   mata terbuka → menutup → terbuka lagi.
 *
 * Kenapa: kalau hanya cek "mata sedang tertutup", orang yang kedip
 * tanpa sadar (atau noise blendshape 1 frame) langsung lolos. Dengan
 * siklus penuh, kedipan harus disengaja dan utuh.
 */
export interface BlinkCycleState {
  /** Mata tertutup di frame sebelumnya (untuk deteksi transisi). */
  wasClosed: boolean;
  /** Timestamp mata mulai menutup (perf.now). */
  closedAt: number | null;
  /** Sudah pernah melihat mata tertutup setidaknya 1 frame. */
  sawClosed: boolean;
}

export function createBlinkCycleState(): BlinkCycleState {
  return { wasClosed: false, closedAt: null, sawClosed: false };
}

/**
 * Update state kedip dan return true jika SIKLUS PENUH selesai
 * (buka → tutup → buka). Pakai threshold lebih tinggi (0.45)
 * supaya tidak mudah false-positive.
 */
export function updateBlinkCycle(
  state: BlinkCycleState,
  blendshapes: { categoryName: string; score: number }[],
  now: number
): boolean {
  const closed = isBlinking(blendshapes, BLINK_THRESHOLD);

  if (closed) {
    // Mata menutup — catat awal penutupan
    state.wasClosed = true;
    state.sawClosed = true;
    if (state.closedAt === null) state.closedAt = now;

    // Mata tertutup TERLALU LAMA (> 1.2s) → bukan kedip, mungkin sengaja
    // pejamkan mata / layar mati. Reset siklus biar harus mulai dari awal.
    if (state.closedAt !== null && now - state.closedAt > MAX_BLINK_CLOSED_MS) {
      state.wasClosed = false;
      state.sawClosed = false;
      state.closedAt = null;
    }
    return false;
  }

  if (!closed && state.wasClosed) {
    // Mata terbuka kembali — satu siklus selesai
    state.wasClosed = false;
    state.closedAt = null;
    return state.sawClosed;
  }

  return false;
}

/** Threshold mata tertutup untuk liveness (lebih tinggi dari enrollment). */
export const BLINK_THRESHOLD = 0.45;

/** Waktu maksimal mata boleh tertutup agar tetap dianggap "kedip" (ms). */
export const MAX_BLINK_CLOSED_MS = 1200;

/**
 * Threshold untuk liveness (beda dari enrollment):
 *   - yaw/pitch dinormalisasi ±1, 0 = lurus.
 *   - Yaw 0.45 ≈ hidung berpindah ~45% lebar rahang ke arah sisi
 *     (≈ 20-30° derajat) — cukup jelas tapi tidak terlalu ekstrem.
 *   - Pitch 0.35 (rumus pitch sudah dikalikan 4x → setara hidung bergeser
 *     ~9% tinggi wajah, ≈ 15-20°).
 *   (Diturunkan dari 0.75/0.60 karena user melaporkan deteksi terlalu
 *   lambat/kurang sensitif. Masih di atas threshold enrollment 0.30/0.25
 *   sehingga tetap butuh gerakan yang jelas, bukan noise 1 frame.)
 */
export const LIVENESS_YAW_THRESHOLD = 0.45;
export const LIVENESS_PITCH_THRESHOLD = 0.35;

/**
 * Lama pose harus ditahan (ms) sebelum dianggap sah.
 * Diturunkan dari 1200ms → 600ms supaya deteksi lebih cepat & responsif,
 * namun tetap cukup lama untuk mencegah "nembak" pose sekilas saat replay.
 */
export const POSE_HOLD_MS = 600;

/** Pool gesture yang bisa dipakai sebagai challenge liveness. */
const CHALLENGE_POOL: ChallengeDef[] = [
  {
    id: 'kanan',
    label: 'Tengok ke Kanan',
    hint: 'Putar wajah jelas ke arah kanan Anda, tahan sebentar',
    holdMs: POSE_HOLD_MS,
    check: (pose) => pose.yaw > LIVENESS_YAW_THRESHOLD,
  },
  {
    id: 'kiri',
    label: 'Tengok ke Kiri',
    hint: 'Putar wajah jelas ke arah kiri Anda, tahan sebentar',
    holdMs: POSE_HOLD_MS,
    check: (pose) => pose.yaw < -LIVENESS_YAW_THRESHOLD,
  },
  {
    id: 'atas',
    label: 'Lihat ke Atas',
    hint: 'Dongakkan wajah Anda, tahan sebentar',
    holdMs: POSE_HOLD_MS,
    check: (pose) => pose.pitch > LIVENESS_PITCH_THRESHOLD,
  },
  {
    id: 'bawah',
    label: 'Tengok ke Bawah',
    hint: 'Tundukkan wajah Anda, tahan sebentar',
    holdMs: POSE_HOLD_MS,
    check: (pose) => pose.pitch < -LIVENESS_PITCH_THRESHOLD,
  },
  {
    id: 'kedip',
    label: 'Kedipkan Mata',
    hint: 'Kedipkan kedua mata Anda sekali (buka-tutup-buka)',
    holdMs: 0, // kedip ditangani khusus via siklus penuh di CameraAbsen
    // NOTE: untuk challenge 'kedip', CameraAbsen memakai updateBlinkCycle()
    // (siklus buka→tutup→buka) — bukan check() ini, karena check() hanya
    // mendeteksi "mata sedang tertutup" yang rawan false-positive.
    check: (_pose, blendshapes) => isBlinking(blendshapes, BLINK_THRESHOLD),
  },
];

/** Jumlah pose acak per sesi liveness. */
export const CHALLENGE_COUNT = 3;

/**
 * Batas waktu TOTAL untuk seluruh sesi liveness (ms).
 * Semua challenge (CHALLENGE_COUNT pose) harus diselesaikan dalam batas ini.
 * Kalau lewat → liveness dianggap gagal (absen tetap dicatat, ditandai mencurigakan).
 */
export const LIVENESS_SESSION_TIMEOUT_MS = 60000;

/**
 * Acak array dengan Fisher–Yates berbasis crypto.getRandomValues.
 * Math.random() bersifat predictable-ish untuk keperluan anti-spoofing,
 * jadi pakai Crypto API.
 */
function shuffleCrypto<T>(arr: T[]): T[] {
  const out = arr.slice();
  const rand = new Uint32Array(out.length);
  crypto.getRandomValues(rand);
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand[i] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Bangun urutan challenge acak untuk satu sesi absen.
 * Dijamin: urutan beda tiap sesi → video teman yang sudah direkam
 * tidak bisa "menebak" urutan & menjawab tepat waktu.
 */
export function generateChallenges(count: number = CHALLENGE_COUNT): ChallengeDef[] {
  return shuffleCrypto(CHALLENGE_POOL).slice(0, Math.min(count, CHALLENGE_POOL.length));
}
