/**
 * Script test otomatis untuk XSS hardening (lapis client).
 *
 * Menjalankan:
 *   npm run test:xss        (atau)   npx tsx scripts/test-xss.ts
 *
 * Yang diuji:
 *   1. isSafeUrl      — validasi skema URL (blokir javascript:/vbscript:/
 *                       data:text/html/svg, izinkan https/data:image/blob:)
 *   2. sanitizeText   — buang karakter kontrol, normalisasi spasi, cap panjang
 *   3. escapeHtml     — encode karakter HTML-sensitive
 *   4. Scan sumber    — pastikan tidak ada dangerouslySetInnerHTML di src/
 *                       dan isSafeUrl terpasang di titik render URL dinamis
 *
 * Keluar dengan exit code 0 (lulus) / 1 (gagal).
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeText, escapeHtml, isSafeUrl } from '../src/lib/sanitize';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  \u2714 ${name}`);
  } catch (err) {
    failed++;
    console.error(`  \u2716 ${name}`);
    if (err instanceof Error) {
      console.error(`      ${err.message.split('\n').join('\n      ')}`);
    }
  }
}

console.log('== Uji 1: isSafeUrl ==');

test('blokir javascript: alert(1)', () => {
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
});

test('blokir javascript: dengan huruf campuran', () => {
  assert.equal(isSafeUrl('JaVaScRiPt:alert(1)'), false);
});

test('blokir javascript: dengan spasi/enter', () => {
  assert.equal(isSafeUrl('java\nscript:alert(1)'), false);
});

test('blokir vbscript:', () => {
  assert.equal(isSafeUrl('vbscript:msgbox(1)'), false);
});

test('blokir data:text/html', () => {
  assert.equal(isSafeUrl('data:text/html,<script>alert(1)</script>'), false);
});

test('blokir data:image/svg+xml (bisa bawa skrip)', () => {
  assert.equal(
    isSafeUrl('data:image/svg+xml,<svg onload="alert(1)"></svg>'),
    false
  );
});

test('blokir ftp: (bukan http/https)', () => {
  assert.equal(isSafeUrl('ftp://example.com/x'), false);
});

test('blokir string kosong / null', () => {
  assert.equal(isSafeUrl(''), false);
  assert.equal(isSafeUrl(null), false);
  assert.equal(isSafeUrl(undefined), false);
});

test('izinkan https:// biasa', () => {
  assert.equal(isSafeUrl('https://example.com/foto.jpg'), true);
});

test('izinkan http://', () => {
  assert.equal(isSafeUrl('http://example.com/a.png'), true);
});

test('izinkan data:image/jpeg (foto absen)', () => {
  assert.equal(isSafeUrl('data:image/jpeg;base64,/9j/4AAQ'), true);
});

test('izinkan data:image/png', () => {
  assert.equal(isSafeUrl('data:image/png;base64,iVBORw0KGgo'), true);
});

test('izinkan blob: (preview kamera)', () => {
  assert.equal(isSafeUrl('blob:http://localhost:3000/abc-123'), true);
});

test('izinkan URL dengan spasi di pinggir (di-trim)', () => {
  assert.equal(isSafeUrl('  https://example.com/a.jpg  '), true);
});

console.log('\n== Uji 2: sanitizeText ==');

test('buang karakter kontrol (\\x00, \\x1f)', () => {
  assert.equal(sanitizeText('a\u0000b\u001fc'), 'abc');
});

test('buang karakter DEL (\\x7f)', () => {
  assert.equal(sanitizeText('a\u007fb'), 'ab');
});

test('normalisasi spasi beruntun + trim', () => {
  assert.equal(sanitizeText('   halo    dunia  '), 'halo dunia');
});

test('jangan buang < > (tetap teks literal, di-escape render)', () => {
  assert.equal(sanitizeText('<script>alert(1)</script>'), '<script>alert(1)</script>');
});

test('cap panjang sesuai maxLen', () => {
  const long = 'A'.repeat(1000);
  assert.equal(sanitizeText(long, 500).length, 500);
});

test('cap panjang default 500', () => {
  const long = 'B'.repeat(1000);
  assert.equal(sanitizeText(long).length, 500);
});

test('null/undefined → string kosong', () => {
  assert.equal(sanitizeText(null), '');
  assert.equal(sanitizeText(undefined), '');
});

console.log('\n== Uji 3: escapeHtml ==');

test('encode & < > " \'', () => {
  assert.equal(
    escapeHtml('<script>alert("x") && \'y\'</script>'),
    '&lt;script&gt;alert(&quot;x&quot;) &amp;&amp; &#039;y&#039;&lt;/script&gt;'
  );
});

test('null/undefined → string kosong', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

console.log('\n== Uji 4: Scan sumber (no dangerouslySetInnerHTML) ==');

const SRC_DIR = join(fileURLToPath(import.meta.url), '../../src');

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(tsx|ts)$/.test(entry)) {
      out.push(full);
    }
  }
}

const allFiles: string[] = [];
walk(SRC_DIR, allFiles);

test('tidak ada dangerouslySetInnerHTML di seluruh src/', () => {
  // Cocokkan pemakaian JSX aktual (`dangerouslySetInnerHTML={{...}}`),
  // bukan penyebutan kata di komentar/dokumentasi.
  const usage = /dangerouslySetInnerHTML\s*=\s*[{<]/;
  const offenders = allFiles.filter((f) => usage.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('isSafeUrl terpasang di titik render URL dinamis (AdminReports)', () => {
  const src = readFileSync(join(SRC_DIR, 'pages/AdminReports.tsx'), 'utf8');
  assert.ok(
    src.includes('isSafeUrl'),
    'AdminReports.tsx seharusnya memakai isSafeUrl untuk photo_url'
  );
});

test('sanitizeText terpasang di titik input (AdminEmployees & EmployeeRegister)', () => {
  const ae = readFileSync(join(SRC_DIR, 'pages/AdminEmployees.tsx'), 'utf8');
  const er = readFileSync(join(SRC_DIR, 'pages/EmployeeRegister.tsx'), 'utf8');
  assert.ok(ae.includes('sanitizeText'), 'AdminEmployees.tsx harus memakai sanitizeText');
  assert.ok(er.includes('sanitizeText'), 'EmployeeRegister.tsx harus memakai sanitizeText');
});

console.log('\n==========================================');
console.log(`Hasil: ${passed} lulus, ${failed} gagal`);
console.log('==========================================');

if (failed > 0) {
  console.error('\nSebagian test GAGAL — periksa detail di atas.');
  process.exit(1);
}
console.log('\nSemua test XSS hardening lulus.');
