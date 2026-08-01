/**
 * Device Identity — ID perangkat stabil untuk soft device binding.
 *
 * Tujuan:
 *   Deteksi kalau 1 akun dipakai dari perangkat yang berbeda-beda
 *   (indikasi "titipan" kredensial ke teman). ID disimpan di localStorage
 *   agar stabil antar sesi, plus fingerprint browser sebagai pelengkap.
 *
 * Catatan pragmatis:
 *   Ini LAPISAN DETEKSI, bukan pencegah mutlak — user yang teknis bisa
 *   hapus localStorage. Kombinasi dengan liveness challenge + flag admin
 *   yang bikin "biaya menipu" jauh lebih tinggi.
 */

const DEVICE_ID_KEY = 'absensi:deviceId';

/** Buat ID acak berbasis crypto. */
function createDeviceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `dev-${hex}`;
}

/** Ambil atau buat device ID yang stabil per browser/perangkat. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = createDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage tidak tersedia (private mode) — fallback ID per-session
    return createDeviceId();
  }
}

/**
 * Fingerprint ringan untuk label perangkat (bukan untuk keamanan,
 * hanya informasi buat admin di tabel user_devices).
 */
export function getDeviceLabel(): string {
  const ua = navigator.userAgent || 'unknown';
  const lang = navigator.language || '';
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      return '';
    }
  })();
  // Potong biar tidak kebanyakan
  const shortUa = ua.length > 120 ? ua.slice(0, 120) : ua;
  return `${shortUa}${lang ? ` | lang:${lang}` : ''}${tz ? ` | tz:${tz}` : ''}`;
}
