-- ==========================================
-- Migration: allow employees to update own time_out
-- Employees need UPDATE ability on attendance_records
-- so they can set time_out / is_forgot_clock_out
-- when doing absen keluar (check-out).
-- ==========================================

drop policy if exists "Employees can update own attendance" on public.attendance_records;
create policy "Employees can update own attendance" on public.attendance_records
  for update using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );
