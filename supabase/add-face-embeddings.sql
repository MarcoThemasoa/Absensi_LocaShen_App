-- ==========================================
-- Migration: Add face_embeddings table
-- Untuk enrollment wajah mandiri oleh karyawan
-- ==========================================

-- 1. Create table
create table if not exists public.face_embeddings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null unique,
  descriptor float8[] not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 2. Index
create index if not exists idx_face_embeddings_user on public.face_embeddings(user_id);

-- 3. RLS
alter table public.face_embeddings enable row level security;

-- 4. Policy: employee can manage own face embeddings (insert, select, update)
drop policy if exists "Users can manage own face embeddings" on public.face_embeddings;
create policy "Users can manage own face embeddings" on public.face_embeddings
  for all
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- 5. Policy: admin can view all face embeddings (for reports / verification)
drop policy if exists "Admins can view all face embeddings" on public.face_embeddings;
create policy "Admins can view all face embeddings" on public.face_embeddings
  for select
  using ( public.is_admin() );
