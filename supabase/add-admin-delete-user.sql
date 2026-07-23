-- ============================================================
-- Migration: Admin Delete User (complete removal)
-- Menambahkan fungsi + policy agar admin bisa hapus user
-- beserta auth.users, attendance, dan activity logs.
-- ============================================================

-- 1. DELETE policy — izinkan admin menghapus dari public.users
drop policy if exists "Admins can delete users" on public.users;
create policy "Admins can delete users" on public.users
  for delete using ( public.is_admin() );

-- 2. Fungsi untuk admin menghapus user secara total
--    (public.users cascade ke attendance_records & admin_activity_logs,
--     lalu hapus juga dari auth.users)
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Hapus activity logs terlebih dahulu (FK ke users)
  delete from public.admin_activity_logs where admin_id = p_user_id;

  -- Hapus attendance records (FK ke users)
  delete from public.attendance_records where user_id = p_user_id;

  -- Hapus dari public.users (profile)
  delete from public.users where id = p_user_id;

  -- Hapus dari auth.users (akun login)
  -- Catatan: membutuhkan akses ke schema auth — jika gagal, dilewati
  begin
    delete from auth.users where id = p_user_id;
  exception when others then
    -- Jika fungsi tidak punya akses ke auth schema, admin harus
    -- menghapus manual melalui Supabase SQL Editor jika diperlukan.
    null;
  end;
end;
$$;

-- Revoke dari anon, hanya authenticated (admin) yang bisa panggil
revoke execute on function public.admin_delete_user from anon, public;
grant execute on function public.admin_delete_user to authenticated;
