-- ==========================================
-- user_devices — soft device binding untuk absen
-- Lapisan 2 anti-spoofing: deteksi 1 akun dipakai dari
-- perangkat berbeda (indikasi kredensial "dititipkan" ke teman).
-- Soft = hanya flag/menandai, tidak memblokir.
-- ==========================================

create table if not exists public.user_devices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null unique,
  device_id text not null,
  device_label text,
  last_seen_at timestamptz default timezone('utc'::text, now()) not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Index lookup by user
create index if not exists idx_user_devices_user on public.user_devices(user_id);

alter table public.user_devices enable row level security;

-- RLS: user lihat/edit device milik sendiri, admin lihat semua
drop policy if exists "Users can manage own device" on public.user_devices;
drop policy if exists "Admins can view all devices" on public.user_devices;
drop policy if exists "Users view own or admins view all devices" on public.user_devices;

create policy "Users view own or admins view all devices"
  on public.user_devices
  for select
  using ( (select auth.uid()) = user_id or public.is_admin() );

drop policy if exists "Users can insert own device" on public.user_devices;
create policy "Users can insert own device"
  on public.user_devices
  for insert
  with check ( (select auth.uid()) = user_id );

drop policy if exists "Users can update own device" on public.user_devices;
create policy "Users can update own device"
  on public.user_devices
  for update
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );
