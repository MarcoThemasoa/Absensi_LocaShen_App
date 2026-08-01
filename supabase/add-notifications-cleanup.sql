-- ==========================================
-- admin_notifications — auto cleanup: hapus notifikasi berumur > 48 jam
--
-- Cara pakai:
--   Buka Supabase → SQL Editor → tempel & jalankan seluruh file ini.
--
-- Cara cek jadwal berjalan:
--   select * from cron.job where jobname = 'admin-notifications-cleanup';
--
-- Cara hapus jadwal (berhenti auto-hapus):
--   select cron.unschedule('admin-notifications-cleanup');
--
-- Cara hapus sisa notifikasi lama secara manual (opsional):
--   delete from public.admin_notifications
--   where created_at < now() - interval '48 hours';
-- ==========================================

-- 1. Aktifkan ekstensi pg_cron (disediakan Supabase)
create extension if not exists pg_cron;

-- 2. Fungsi penghapus notifikasi lama.
--    security definer + set search_path = public → jalan sebagai pemilik tabel
--    sehingga bisa DELETE meskipun RLS hanya mengizinkan admin SELECT.
create or replace function public.delete_old_admin_notifications()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.admin_notifications
  where created_at < now() - interval '48 hours';
$$;

-- Jangan biarkan user biasa memanggil fungsi ini lewat API (hanya cron yang pakai)
revoke all on function public.delete_old_admin_notifications() from public;
revoke all on function public.delete_old_admin_notifications() from anon;
revoke all on function public.delete_old_admin_notifications() from authenticated;

-- 3. Jadwalkan tiap jam (menit ke-0): hapus semua notifikasi > 48 jam.
--    jobname unik → aman dijalankan ulang (schedule lama di-unschedule dulu).
select cron.unschedule('admin-notifications-cleanup')
where exists (select 1 from cron.job where jobname = 'admin-notifications-cleanup');

select cron.schedule(
  'admin-notifications-cleanup',
  '0 * * * *',
  'select public.delete_old_admin_notifications();'
);
