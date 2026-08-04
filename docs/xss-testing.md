# Panduan Pengujian XSS Hardening

Panduan ini menjelaskan cara menguji seluruh lapisan perlindungan XSS yang
terpasang di proyek ini:

1. **Sanitasi input** — `src/lib/sanitize.ts` (`sanitizeText`, `escapeHtml`, `isSafeUrl`)
2. **Sanitasi output render** — React auto-escape (pertahanan utama)
3. **Hardening database** — `supabase/add-xss-hardening.sql` (`handle_new_user`, `notify_admin`, CHECK constraint)
4. **Content Security Policy (CSP)** — `vercel.json` (produksi) + `<meta>` di `index.html` (dev)

---

## 1. Test Otomatis (fast & repeatable)

Prasyarat: `node_modules` sudah terpasang (`npm install`).

```bash
npm run test:xss
```

Atau langsung tanpa menambah script npm:

```bash
npx tsx scripts/test-xss.ts
```

### Apa yang diuji script ini

| Kelompok | Kasus |
|---|---|
| `isSafeUrl` | Blokir `javascript:`, `vbscript:`, `data:text/html`, `data:image/svg+xml`, `ftp:`; izinkan `https/http`, `data:image/jpeg|png|webp|gif`, `blob:` |
| `sanitizeText` | Buang karakter kontrol `\x00-\x1f`, `\x7f`; normalisasi spasi; cap panjang (default 500) |
| `escapeHtml` | Encode `& < > " '` |
| Scan sumber | Tidak ada `dangerouslySetInnerHTML` di `src/`; `isSafeUrl` & `sanitizeText` terpasang di halaman yang relevan |

Exit code `0` = lulus, `1` = ada yang gagal.

---

## 2. Test Stored XSS (data jahat tersimpan di DB → dirender)

Karena React auto-escape, **payload yang aman akan terlihat sebagai teks
mentah di layar** — itu tanda yang benar. Yang salah adalah jika alert/script
sama sekali **tereksekusi**.

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 1 | Daftar karyawan baru dengan nama `<img src=x onerror=alert(1)> Budi` | Nama tampil sebagai teks literal; **tidak ada** alert |
| 2 | Edit nama karyawan via admin → isi `"><script>alert(1)</script>` | Tampil sebagai teks; karakter `<` tidak dieksekusi |
| 3 | Masukkan pesan notifikasi jahat langsung ke DB: di Supabase SQL Editor → `insert into admin_notifications (type, user_id, message) values ('late_checkin', '<uid>', '<script>alert(1)</script>');` lalu buka dashboard admin | Tampil sebagai teks; tidak ada execution |
| 4 | Set `photo_url` suatu record absen menjadi `javascript:alert(1)` via SQL Editor → buka **Admin → Laporan** | `<img>` tidak dirender / tidak mengeksekusi URL (diblokir `isSafeUrl`) |
| 5 | Set `photo_url` menjadi `data:text/html,<script>alert(1)</script>` → buka laporan | Diblokir (hanya `data:image/*` yang diizinkan) |

> Tips: untuk uji cepat, tempel payload di kolom **nama** pada form register
> dan admin, lalu periksa halaman dashboard karyawan & admin.

---

## 3. Test Reflected XSS (payload di URL)

Payload berikut **tidak boleh** dieksekusi maupun tampil "mentah" di halaman —
halaman harus berfungsi normal karena nilai param dibandingkan terhadap literal
(`=== 'keluar'`, `=== '1'`):

```
/auth/login?next=%22%3E%3Cscript%3Ealert(1)%3C/script%3E
/absen/kamera?type=keluar%22%3E%3Cscript%3Ealert(1)%3C/script%3E
/admin/laporan?log=1%22%3E%3Cscript%3Ealert(1)%3C/script%3E
/enroll-wajah?mode=update%22%3E%3Cscript%3Ealert(1)%3C/script%3E
```

Periksa juga di DevTools → Console: tidak boleh ada error eksekusi script.

---

## 4. Test Content Security Policy (CSP)

### 4a. Produksi (Vercel)

```bash
curl -I https://<domain-anda>.vercel.app
```

Pastikan header berikut ada:

```
content-security-policy: default-src 'self'; ...
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
```

### 4b. Di browser (DevTools → Console)

| Uji | Cara | Hasil yang diharapkan |
|---|---|---|
| `eval()` diblokir | Ketik `eval('1+1')` di Console | Error: *"Refused to evaluate a string as JavaScript"* |
| Inline handler diblokir | Ketik di Console: `document.body.innerHTML='<img src=x onerror=alert(1)>'` | `onerror` TIDAK jalan |
| Refused messages | Perhatikan warning "Refused to ... Content-Security-Policy" | Tidak boleh muncul di halaman normal |

### 4c. Regresi (jangan sampai CSP over-restrictive)

Fitur berikut harus tetap berfungsi setelah CSP aktif:

- **Halaman absen kamera** — preview webcam & blob URL
- **Dashboard admin** — peta Leaflet/OSM (tiles dari domain luar)
- **Upload foto / preview** di laporan
- **Login/register** — fetch ke Supabase

Kalau ada yang rusak, lihat pesan CSP di Console lalu sesuaikan di `vercel.json`.

---

## 5. Test Hardening SQL (Supabase SQL Editor)

Jalankan langsung di **Supabase Dashboard → SQL Editor**:

```sql
-- 5a. notify_admin: pesan > 500 char harus ter-truncate, control char ter-buang
select public.notify_admin('late_checkin', null, repeat('A', 600) || E'\u0000<script>');
select message, char_length(message) as len
from admin_notifications
order by created_at desc limit 1;  -- len harus <= 500, tanpa \u0000

-- 5b. notify_admin: tipe tidak dikenal harus raise error
select public.notify_admin('hack', null, 'x');  -- harus error: unknown type

-- 5c. handle_new_user: age bukan angka → null (bukan crash)
select public.handle_new_user(
  '00000000-0000-0000-0000-000000000001',
  'budi@test.com',
  'Budi',
  'abc',          -- age invalid
  '00000000-0000-0000-0000-000000000099' -- location_id tidak ada
);  -- harus sukses, age = null, location_id = null
```

> Catatan: `handle_new_user` dipanggil otomatis oleh trigger `on_auth_user_created`.
> Uji manual ini hanya untuk memastikan fungsi aman terhadap input jahat.

---

## 6. Debug Log Wajah (`[Face:...]`)

Kalau "skor wajah tidak bisa dihitung", aktifkan log untuk melihat alurnya.
Log **selalu dicetak ke console** di semua environment (termasuk build Vercel).

Buka halaman **absen kamera**, lalu buka **DevTools → Console** dan cari baris
`[Face:...]`:

| Scope | Isi |
|---|---|
| `[Face:faceApi]` | Init face-api: backend WebGL/CPU, model dimuat, status siap |
| `[Face:faceMatcher]` | `loadFaceDescriptor` cache hit/miss, **belum enrollment** (descriptor null) |
| `[Face:faceCheck]` | Wajah terdeteksi?, stored dimuat?, skor pre-check per frame |
| `[Face:liveness]` | Progres challenge |
| `[Face:faceMatch]` | Ekstraksi akhir, jumlah descriptor, buffer kosong?, skor akhir + pass |

**Pola pembacaan log:**
- `buffer snapshot KOSONG` → tidak ada frame frontal saat liveness (user menoleh terus / kamera gelap)
- `stored descriptor null` → user **belum enrollment wajah** (skor memang tidak dihitung)
- `skor AKHIR: WAJAH TIDAK COCOK` → jarak > 0.5, wajah dianggap orang lain
- Tidak ada log `[Face:faceApi] siap` → face-api gagal download/init (cek jaringan)

---

## Ringkasan Alur Verifikasi

```text
1. npm run test:xss                    → lapis client lolos?
2. Uji stored XSS (nama/pesan/foto)    → tampil sebagai teks?
3. Uji reflected XSS (URL)             → halaman normal?
4. curl -I + DevTools                  → CSP aktif & tidak over-restrictive?
5. SQL Editor                          → notify_admin & handle_new_user aman?
6. (opsional) Cek [Face:...] log       → skor wajah terhitung?
```
