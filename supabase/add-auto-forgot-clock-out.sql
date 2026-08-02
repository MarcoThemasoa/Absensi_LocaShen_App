-- ==========================================
-- Auto-mark "lupa clock-out" setiap tengah malam (00:00)
--
-- Tujuan:
--   Setiap hari pukul 00:00, cek semua karyawan yang sudah absen masuk
--   (time_in ada) tapi BELUM absen keluar (time_out kosong) pada tanggal
--   yang sudah lewat. Kalau tidak ada jam keluar → otomatis tandai
--   is_forgot_clock_out = true (lupa absen keluar).
--
-- Kenapa hanya tanggal < current_date:
--   Record hari ini masih berlangsung (karyawan belum pulang) — jangan
--   ditandai lupa. Hanya tanggal yang sudah lewat yang dianggap "lupa".
--
-- Cara pakai:
--   Buka Supabase → SQL Editor → tempel & jalankan seluruh file ini.
--
-- Cara cek jadwal berjalan:
--   select * from cron.job where jobname = 'auto-forgot-clock-out';
--
-- Cara hapus jadwal (berhenti auto-mark):
--   select cron.unschedule('auto-forgot-clock-out');
-- ==========================================

-- 1. Aktifkan ekstensi pg_cron (disediakan Supabase)
create extension if not exists pg_cron;

-- 2. Fungsi penanda lupa clock-out.
--    security definer + set search_path = public → jalan sebagai pemilik tabel
--    sehingga bisa UPDATE meskipun RLS membatasi akses user biasa.
--    time_out diisi '17:00:00' agar konsisten dengan logika
--    checkYesterdayForgotClockOut di aplikasi (AuthContext).
create or replace function public.mark_forgot_clock_out()
returns void
language sql
security definer
set search_path = public
as $$
  update public.attendance_records
  set is_forgot_clock_out = true,
      time_out = coalesce(time_out, '17:00:00')
  where date < current_date
    and time_in is not null
    and time_out is null
    and is_forgot_clock_out = false;
$$;

-- Jangan biarkan user biasa memanggil fungsi ini lewat API (hanya cron yang pakai)
revoke all on function public.mark_forgot_clock_out() from public;
revoke all on function public.mark_forgot_clock_out() from anon;
revoke all on function public.mark_forgot_clock_out() from authenticated;

-- 3. Jadwalkan setiap tengah malam (00:00) — tandai lupa clock-out.
--    jobname unik → aman dijalankan ulang (schedule lama di-unschedule dulu).
select cron.unschedule('auto-forgot-clock-out')
where exists (select 1 from cron.job where jobname = 'auto-forgot-clock-out');

select cron.schedule(
  'auto-forgot-clock-out',
  '0 0 * * *',
  'select public.mark_forgot_clock_out();'
);