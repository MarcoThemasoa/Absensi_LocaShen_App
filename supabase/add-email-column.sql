-- ============================================================
-- Migration: Add email column + auto-save from auth
-- Email disimpan otomatis ke public.users via trigger saat
-- user mendaftar, sehingga tidak perlu query ke auth.users.
-- ============================================================

-- 1. Tambah kolom email ke public.users
alter table public.users add column if not exists email text;

-- 2. Update fungsi trigger agar juga menyimpan email
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, role, status, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    'employee',
    'pending',
    new.email
  );
  return new;
end;
$$;
