-- ==========================================
-- Supabase Schema Setup for GeoFace App
-- ==========================================

-- Enable PostGIS for geospatial queries if needed in the future
create extension if not exists postgis;

-- 1. Create Custom Types
create type user_role as enum ('employee', 'admin');
create type user_status as enum ('active', 'pending');
create type attendance_status as enum ('hadir', 'telat', 'alpha', 'cuti');

-- 2. Create Tables
create table public.users (
  id uuid references auth.users(id) primary key,
  name text not null,
  role user_role not null default 'employee',
  status user_status not null default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.office_locations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  radius integer not null default 100, -- in meters
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.attendance_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  date date not null,
  time_in time without time zone not null,
  time_out time without time zone,
  status attendance_status not null,
  location_lat double precision not null,
  location_lng double precision not null,
  photo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.office_locations enable row level security;
alter table public.attendance_records enable row level security;

-- 4. RLS Policies for Users Table
-- Admins can read and update all users
create policy "Admins can view all users" on public.users
  for select using ( auth.uid() in (select id from public.users where role = 'admin') );

create policy "Admins can update all users" on public.users
  for update using ( auth.uid() in (select id from public.users where role = 'admin') );

-- Employees can read their own profile
create policy "Users can view own profile" on public.users
  for select using ( auth.uid() = id );

-- Allow insert during registration (with trigger to automatically link to auth.users if using Supabase Auth)
create policy "Allow insert on registration" on public.users
  for insert with check ( auth.uid() = id );

-- 5. RLS Policies for Office Locations Table
-- Everyone can read locations (needed for check-in validation)
create policy "Anyone can view locations" on public.office_locations
  for select using ( true );

-- Only Admins can modify locations
create policy "Admins can modify locations" on public.office_locations
  for all using ( auth.uid() in (select id from public.users where role = 'admin') );

-- 6. RLS Policies for Attendance Records Table
-- Admins can view all attendance records
create policy "Admins can view all attendance" on public.attendance_records
  for select using ( auth.uid() in (select id from public.users where role = 'admin') );

-- Employees can view their own attendance records
create policy "Employees can view own attendance" on public.attendance_records
  for select using ( auth.uid() = user_id );

-- Employees can insert their own attendance
create policy "Employees can insert own attendance" on public.attendance_records
  for insert with check ( auth.uid() = user_id );

-- Employees can update their own attendance (e.g. checking out)
create policy "Employees can update own attendance" on public.attendance_records
  for update using ( auth.uid() = user_id );

-- 7. Functions & Triggers
-- Automatically create user profile after Supabase Auth signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, name, role, status)
  values (new.id, new.raw_user_meta_data->>'full_name', 'employee', 'pending');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
