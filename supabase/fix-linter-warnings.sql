-- ============================================================
-- Migration: Fix Supabase Database Linter Warnings
--
-- Menangani:
--   1. SECURITY DEFINER — rls_auto_enable() diekspos ke anon
--   2. SECURITY DEFINER — admin_delete_user() tanpa admin check
--   3. Multiple Permissive Policies — attendance_records UPDATE
--   4. Unindexed Foreign Key — users.location_id
--   5. Redundant Index — idx_attendance_user_date
-- ============================================================

-- 1. REVOKE: rls_auto_enable() dari semua role publik
--    Fungsi ini tidak didefinisikan di project, tapi muncul di database.
--    Tidak ada alasan anon/authenticated bisa menjalankannya.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

-- 2. SECURITY: Tambah admin check di admin_delete_user()
--    Sebelumnya: SEMUA authenticated user bisa panggil fungsi ini.
--    Sesudah: Hanya admin yang bisa menjalankan penghapusan user.
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Hanya admin yang boleh menghapus user
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menghapus user';
  end if;

  -- Hapus activity logs terlebih dahulu (FK ke users)
  delete from public.admin_activity_logs where admin_id = p_user_id;

  -- Hapus attendance records (FK ke users)
  delete from public.attendance_records where user_id = p_user_id;

  -- Hapus dari public.users (profile)
  delete from public.users where id = p_user_id;

  -- Hapus dari auth.users (akun login)
  begin
    delete from auth.users where id = p_user_id;
  exception when others then
    null;
  end;
end;
$$;

-- 3. PERF: Merge 2 UPDATE policy attendance_records jadi 1
--    Sebelumnya: "Admins can update attendance" + "Employees can update own attendance"
--    Keduanya permissive → Postgres evaluasi keduanya di setiap query UPDATE.
--    Sesudah: 1 policy dengan OR condition.
drop policy if exists "Admins can update attendance" on public.attendance_records;
drop policy if exists "Employees can update own attendance" on public.attendance_records;
create policy "Users can update own or admins update all attendance" on public.attendance_records
  for update using ( (select auth.uid()) = user_id or public.is_admin() )
  with check ( (select auth.uid()) = user_id or public.is_admin() );

-- 4. PERF: Index untuk foreign key users.location_id
--    Query yang filter/join by location_id di tabel users sekarang pake index scan.
create index if not exists idx_users_location_id on public.users(location_id);

-- 5. CLEANUP: Drop redundant index (sudah di-cover oleh unique index uq_attendance_user_date)
drop index if exists idx_attendance_user_date;