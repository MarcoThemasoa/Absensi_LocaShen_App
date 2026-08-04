/**
 * Logger debug untuk alur deteksi wajah (face-api loading, face matching,
 * liveness). SELALU dicetak ke console di semua environment — diminta oleh
 * pemilik proyek untuk memudahkan debugging "skor tidak bisa dihitung" saat
 * uji di HP (termasuk build produksi Vercel).
 *
 * Pemakaian:
 *   logFace('faceApi', 'init dimulai');
 *   logFace('faceCheck', 'wajah frontal', { yaw: 0.1, pitch: 0.2 });
 *   warnFace('faceMatch', 'stored descriptor null = belum enrollment');
 *
 * Format output: [Face:scope] pesan …args (scope di-uppercase otomatis).
 */

type Scope =
  | 'faceApi'     // init face-api (tfjs + model recognition)
  | 'model'       // download/init model MediaPipe (face_landmarker.task + wasm)
  | 'faceMatcher' // load/save descriptor dari Supabase
  | 'faceCheck'   // pre-check loop di step 'face'
  | 'liveness'    // anti-spoofing challenge
  | 'faceMatch';  // matching descriptor setelah liveness

const STYLE = 'color:#0d9488;font-weight:bold';

function fmt(scope: Scope): string {
  return `%c[Face:${scope}]`;
}

/** Log info — alur normal yang perlu dilacak. */
export function logFace(scope: Scope, message: string, ...args: unknown[]): void {
  console.log(fmt(scope), STYLE, message, ...args);
}

/** Log peringatan — kondisi tidak ideal tapi tidak fatal. */
export function warnFace(scope: Scope, message: string, ...args: unknown[]): void {
  console.warn(fmt(scope), STYLE, message, ...args);
}

/** Log error — exception / kegagalan yang fatal untuk alur skor. */
export function errorFace(scope: Scope, message: string, ...args: unknown[]): void {
  console.error(fmt(scope), STYLE, message, ...args);
}
