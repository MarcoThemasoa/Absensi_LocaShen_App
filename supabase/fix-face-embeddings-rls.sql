-- ============================================================
-- Migration: Fix Multiple Permissive Policies on face_embeddings
--
-- Masalah:
--   "Users can manage own face embeddings" → FOR ALL (termasuk SELECT)
--   "Admins can view all face embeddings" → FOR SELECT
--   → Multiple permissive policies untuk action SELECT di role yg sama
--
-- Fix:
--   1. Hapus kedua policy lama
--   2. SELECT: merge jadi 1 policy (user own OR admin all)
--   3. INSERT/UPDATE/DELETE: terpisah, hanya untuk user sendiri
-- ============================================================

-- 1. Hapus policy lama
drop policy if exists "Users can manage own face embeddings" on public.face_embeddings;
drop policy if exists "Admins can view all face embeddings" on public.face_embeddings;

-- 2. SELECT — satu policy merged
drop policy if exists "Users view own or admins view all face embeddings" on public.face_embeddings;
create policy "Users view own or admins view all face embeddings"
  on public.face_embeddings
  for select
  using ( (select auth.uid()) = user_id or public.is_admin() );

-- 3. INSERT — hanya user sendiri (saat enrollment wajah)
drop policy if exists "Users can insert own face embeddings" on public.face_embeddings;
create policy "Users can insert own face embeddings"
  on public.face_embeddings
  for insert
  with check ( (select auth.uid()) = user_id );

-- 4. UPDATE — hanya user sendiri
drop policy if exists "Users can update own face embeddings" on public.face_embeddings;
create policy "Users can update own face embeddings"
  on public.face_embeddings
  for update
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- 5. DELETE — hanya user sendiri
drop policy if exists "Users can delete own face embeddings" on public.face_embeddings;
create policy "Users can delete own face embeddings"
  on public.face_embeddings
  for delete
  using ( (select auth.uid()) = user_id );
