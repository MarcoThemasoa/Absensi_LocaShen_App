-- =============================================================================
-- Migration: Face API v2 — Reset embedding lama (1434-d MediaPipe landmark)
-- =============================================================================
--
-- LATAR BELAKANG
--   Sebelumnya, face descriptor memakai 478 landmark MediaPipe + normalisasi
--   geometri sederhana (descriptor 1434-d). Metode itu TIDAK diskriminatif:
--   dua wajah berbeda bisa menghasilkan skor jarak yang hampir sama dengan
--   wajah asli (skor hijau palsu).
--
--   Sekarang verifikasi wajah memakai @vladmandic/face-api FaceRecognitionNet
--   (descriptor 128-d yang dilatih khusus untuk face recognition). Format
--   descriptor BERUBAH → semua data lama TIDAK kompatibel dan HARUS dihapus.
--
-- CARA PAKAI
--   1. Jalankan script ini di Supabase SQL Editor SEKALI.
--   2. Semua karyawan WAJIB melakukan "Perbarui Wajah" (re-enroll) sekali
--      lagi. App akan otomatis memberi tahu mereka kalau belum enrollment
--      (facePreCheckPass = true fallback saat tidak ada descriptor).
-- =============================================================================

begin;

-- Hapus SEMUA embedding lama (format 1434-d tidak kompatibel dengan 128-d).
-- Ini juga otomatis menghapus flag "sudah enrollment" → app meminta re-enroll.
delete from public.face_embeddings;

-- Opsional: reset RLS sementara tidak perlu diubah — tabel tetap sama.
-- Tabel `face_embeddings` TIDAK diubah strukturnya (descriptor float8[]
-- bisa menampung 128 angka sama seperti 1434).

commit;
