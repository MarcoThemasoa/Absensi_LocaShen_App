-- ==========================================
-- Supabase Schema for Absensi Digital GeoFace
-- Fully idempotent — safe to re-run.
-- v2: fixes RLS recursion, function hardening,
--     redundant insert policy, admin-only attendance
--     updates, data-integrity constraints, private bucket.
-- ==========================================

-- 1. Custom Enums
do $$ begin
  create type user_role as enum ('employee', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type user_status as enum ('active', 'pending');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type attendance_status as enum ('hadir', 'telat', 'alpha', 'cuti');
exception when duplicate_object then null;
end $$;

-- 2. Tables
create table if not exists public.office_locations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  radius integer not null default 100,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists public.users (
  id uuid references auth.users(id) primary key,
  name text not null,
  role user_role not null default 'employee',
  status user_status not null default 'pending',
  position text,
  division text,
  age integer,
  location_id uuid references public.office_locations(id),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- time_in / lat / lng are nullable now to accommodate 'cuti' (leave) records;
-- enforced via CHECK constraint below instead of NOT NULL.
create table if not exists public.attendance_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  date date not null,
  time_in time,
  time_out time,
  status attendance_status not null,
  location_lat double precision,
  location_lng double precision,
  photo_url text,
  is_forgot_clock_out boolean not null default false,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Idempotent column addition for existing tables (safe to re-run)
do $$ begin
  alter table public.attendance_records add column is_forgot_clock_out boolean not null default false;
exception when duplicate_column then null;
end $$;

create table if not exists public.admin_activity_logs (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references public.users(id) not null,
  action text not null,
  action_timestamp timestamptz default timezone('utc'::text, now()) not null,
  location_lat double precision,
  location_lng double precision,
  location_name text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. Indexes
create index if not exists idx_attendance_user_date on public.attendance_records(user_id, date);
create index if not exists idx_attendance_date on public.attendance_records(date);
create index if not exists idx_activity_logs_admin on public.admin_activity_logs(admin_id);
create index if not exists idx_users_role on public.users(role);

-- one attendance row per employee per day
create unique index if not exists uq_attendance_user_date
  on public.attendance_records(user_id, date);

-- 4. Data-integrity CHECK constraints
-- (added via DO blocks so the script stays re-runnable —
--  Postgres has no "ADD CONSTRAINT IF NOT EXISTS")

do $$ begin
  alter table public.users
    add constraint chk_users_age check (age is null or (age > 0 and age < 120));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.office_locations
    add constraint chk_locations_radius check (radius > 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.office_locations
    add constraint chk_locations_lat check (lat between -90 and 90);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.office_locations
    add constraint chk_locations_lng check (lng between -180 and 180);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.attendance_records
    add constraint chk_attendance_lat check (location_lat is null or location_lat between -90 and 90);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.attendance_records
    add constraint chk_attendance_lng check (location_lng is null or location_lng between -180 and 180);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.attendance_records
    add constraint chk_attendance_time_order
    check (time_out is null or time_in is null or time_out > time_in);
exception when duplicate_object then null;
end $$;

-- 'cuti' (leave) rows may omit time/location; every other status must have them
do $$ begin
  alter table public.attendance_records
    add constraint chk_attendance_cuti_fields
    check (
      status = 'cuti'
      or (time_in is not null and location_lat is not null and location_lng is not null)
    );
exception when duplicate_object then null;
end $$;

-- 5. Enable Row Level Security (idempotent)
alter table public.users enable row level security;
alter table public.office_locations enable row level security;
alter table public.attendance_records enable row level security;
alter table public.admin_activity_logs enable row level security;

-- 6. Helper: non-recursive admin check
-- security definer bypasses RLS on the internal lookup, so policies
-- on public.users that call this no longer trigger themselves.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- 7. RLS — Users
drop policy if exists "Admins can view all users" on public.users;
create policy "Admins can view all users" on public.users
  for select using ( public.is_admin() );

drop policy if exists "Admins can update all users" on public.users;
create policy "Admins can update all users" on public.users
  for update using ( public.is_admin() );

drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile" on public.users
  for select using ( auth.uid() = id );

-- Removed: "Allow insert on registration" — user rows are created
-- exclusively by the handle_new_user() trigger below. Client-side
-- inserts into public.users are no longer permitted by any policy.
drop policy if exists "Allow insert on registration" on public.users;

-- 8. RLS — Office Locations
drop policy if exists "Anyone can view locations" on public.office_locations;
create policy "Anyone can view locations" on public.office_locations
  for select using ( true );

drop policy if exists "Admins can modify locations" on public.office_locations;
create policy "Admins can modify locations" on public.office_locations
  for all using ( public.is_admin() );

-- 9. RLS — Attendance Records
drop policy if exists "Admins can view all attendance" on public.attendance_records;
create policy "Admins can view all attendance" on public.attendance_records
  for select using ( public.is_admin() );

drop policy if exists "Employees can view own attendance" on public.attendance_records;
create policy "Employees can view own attendance" on public.attendance_records
  for select using ( auth.uid() = user_id );

drop policy if exists "Employees can insert own attendance" on public.attendance_records;
create policy "Employees can insert own attendance" on public.attendance_records
  for insert with check ( auth.uid() = user_id );

-- Employee self-update removed. Only admins may modify attendance
-- records after creation (e.g. correcting status, setting time_out).
drop policy if exists "Employees can update own attendance" on public.attendance_records;

drop policy if exists "Admins can update attendance" on public.attendance_records;
create policy "Admins can update attendance" on public.attendance_records
  for update using ( public.is_admin() )
  with check ( public.is_admin() );

-- 10. RLS — Admin Activity Logs
drop policy if exists "Admins can view activity logs" on public.admin_activity_logs;
create policy "Admins can view activity logs" on public.admin_activity_logs
  for select using ( public.is_admin() );

drop policy if exists "Admins can insert activity logs" on public.admin_activity_logs;
create policy "Admins can insert activity logs" on public.admin_activity_logs
  for insert with check ( public.is_admin() );

-- 11. Trigger: auto-create user profile after signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, role, status)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    'employee',
    'pending'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Lock down: prevent REST API exposure (trigger-only function)
revoke execute on function public.handle_new_user() from anon, authenticated;

-- 12. Storage: bucket for attendance photos
-- public = false: files are only reachable via signed URLs, so the
-- storage RLS policies below actually mean something.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-photos', 'attendance-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

drop policy if exists "Authenticated users can upload attendance photos" on storage.objects;
create policy "Authenticated users can upload attendance photos"
on storage.objects for insert
with check ( bucket_id = 'attendance-photos' and auth.role() = 'authenticated' );

drop policy if exists "Authenticated users can view attendance photos" on storage.objects;
create policy "Authenticated users can view attendance photos"
on storage.objects for select
using ( bucket_id = 'attendance-photos' and auth.role() = 'authenticated' );

-- ==========================================
-- v3: fixes Auth RLS Initialization Plan warnings,
--     Multiple Permissive Policies warnings,
--     and Security Definer public-execute exposure.
-- ==========================================

-- 1. Re-secure functions: revoke from PUBLIC, not just anon/authenticated
revoke all on function public.is_admin() from public;
revoke all on function public.handle_new_user() from public;

-- Only authenticated sessions need to invoke is_admin() (it's used inside
-- policies evaluated as the querying user). Nobody should call it via RPC directly,
-- but Postgres still requires EXECUTE for policy evaluation to succeed.
grant execute on function public.is_admin() to authenticated;

-- handle_new_user stays trigger-only — no role gets EXECUTE.

-- Also optimize the function body itself (single evaluation of auth.uid())
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- 2. USERS — merge the two permissive SELECT policies into one
drop policy if exists "Admins can view all users" on public.users;
drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile or admins view all" on public.users
  for select using (
    (select auth.uid()) = id or public.is_admin()
  );

drop policy if exists "Admins can update all users" on public.users;
create policy "Admins can update all users" on public.users
  for update using ( public.is_admin() )
  with check ( public.is_admin() );

-- 3. OFFICE_LOCATIONS — split "for all" so it no longer overlaps
--    with the public SELECT policy
drop policy if exists "Anyone can view locations" on public.office_locations;
create policy "Anyone can view locations" on public.office_locations
  for select using ( true );

drop policy if exists "Admins can modify locations" on public.office_locations;

drop policy if exists "Admins can insert locations" on public.office_locations;
create policy "Admins can insert locations" on public.office_locations
  for insert with check ( public.is_admin() );

drop policy if exists "Admins can update locations" on public.office_locations;
create policy "Admins can update locations" on public.office_locations
  for update using ( public.is_admin() )
  with check ( public.is_admin() );

drop policy if exists "Admins can delete locations" on public.office_locations;
create policy "Admins can delete locations" on public.office_locations
  for delete using ( public.is_admin() );

-- 4. ATTENDANCE_RECORDS — merge SELECT policies, wrap auth.uid()
drop policy if exists "Admins can view all attendance" on public.attendance_records;
drop policy if exists "Employees can view own attendance" on public.attendance_records;
create policy "Employees view own or admins view all attendance" on public.attendance_records
  for select using (
    (select auth.uid()) = user_id or public.is_admin()
  );

drop policy if exists "Employees can insert own attendance" on public.attendance_records;
create policy "Employees can insert own attendance" on public.attendance_records
  for insert with check ( (select auth.uid()) = user_id );

drop policy if exists "Admins can update attendance" on public.attendance_records;
create policy "Admins can update attendance" on public.attendance_records
  for update using ( public.is_admin() )
  with check ( public.is_admin() );

-- 5. ADMIN_ACTIVITY_LOGS — no overlap here, but ensure is_admin() usage is consistent
--    (already single policy per command — no change needed structurally)