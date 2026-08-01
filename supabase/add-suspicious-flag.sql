-- ==========================================
-- attendance_records — kolom flag mencurigakan (Lapisan 3)
-- is_suspicious   : true jika absen terindikasi mencurigakan
--                   (wajah tidak cocok / liveness gagal / ganti device)
-- liveness_passed : hasil verifikasi liveness saat absen
--                   (true / false / null = model tidak jalan)
-- ==========================================

do $$ begin
  alter table public.attendance_records add column is_suspicious boolean not null default false;
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table public.attendance_records add column liveness_passed boolean;
exception when duplicate_column then null;
end $$;
