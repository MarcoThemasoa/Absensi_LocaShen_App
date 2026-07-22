-- ============================================================
-- FIX: Tidak perlu ubah constraint — seed sekarang selalu insert
--      nilai time_in / location untuk SEMUA status (termasuk alpha/cuti).
--
-- Jika sebelumnya sudah terlanjur drop constraint, jalankan
-- script ini untuk mengembalikannya ke bentuk original.
-- ============================================================
alter table public.attendance_records
  drop constraint if exists chk_attendance_cuti_fields;

alter table public.attendance_records
  add constraint chk_attendance_cuti_fields
  check (
    status = 'cuti'
    or (time_in is not null and location_lat is not null and location_lng is not null)
  );
