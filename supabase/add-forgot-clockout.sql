-- ==========================================
-- Migration: add is_forgot_clock_out column
-- Adds support for "lupa absen keluar" detection
-- ==========================================

do $$ begin
  alter table public.attendance_records
    add column is_forgot_clock_out boolean not null default false;
exception when duplicate_column then null;
end $$;
