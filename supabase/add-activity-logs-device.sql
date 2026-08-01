-- ============================================================
-- Migration: tambah kolom device di admin_activity_logs
-- Kolom ini menyimpan jenis perangkat (getShortDeviceType():
-- "Windows" | "Android" | "iPhone" | "iPad" | "macOS" | "Linux")
-- saat admin melakukan aksi. Ditampilkan di Log Aktivitas sebagai
-- "Oleh {Nama} - {Cabang} ({Device})".
-- ============================================================

alter table public.admin_activity_logs
  add column if not exists device text;
