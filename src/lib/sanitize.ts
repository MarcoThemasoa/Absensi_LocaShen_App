/**
 * Utilitas sanitasi — pertahanan berlapis terhadap XSS (reflected & stored).
 *
 * React sudah auto-escape teks, jadi fungsi ini untuk pertahanan kedua:
 *   - escapeHtml : dipakai bila string user dirender ke dalam HTML/attribute
 *     atau bila suatu saat kode memakai dangerouslySetInnerHTML.
 *   - sanitizeText : membersihkan input di titik masuk (form submit) —
 *     buang karakter kontrol, trim, cap panjang.
 *   - isSafeUrl : validasi skema URL sebelum dipakai di <img src>/href,
 *     mencegah javascript: / data:text/html injection.
 */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Buang karakter kontrol + whitespace berlebih, lalu cap panjang. */
export function sanitizeText(
  input: string | null | undefined,
  maxLen = 500
): string {
  if (!input) return '';
  const cleaned = input
    .replace(CONTROL_CHARS, '')   // buang karakter kontrol (\x00-\x1f)
    .replace(/\s+/g, ' ')          // normalisasi spasi beruntun
    .trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

/** Encode HTML-sensitive characters (defense-in-depth untuk output). */
export function escapeHtml(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validasi skema URL agar aman dipakai di <img src> / href.
 * Hanya izinkan: http(s), data:image (foto absen), blob: (preview kamera).
 * Blokir: javascript:, data:text/html, vbscript:, dll.
 */
export function isSafeUrl(
  url: string | null | undefined
): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
    return false;
  }
  if (lower.startsWith('data:')) {
    // Hanya izinkan data image (foto absen / screenshot kamera)
    return /^data:image\/(jpeg|png|webp|gif);/i.test(lower);
  }
  if (lower.startsWith('blob:')) return true;
  return /^https?:\/\//i.test(lower);
}
