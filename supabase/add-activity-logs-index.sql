-- Migration: add index on admin_activity_logs.action_timestamp DESC
-- 
-- Query di AdminReports: SELECT ... FROM admin_activity_logs ORDER BY action_timestamp DESC LIMIT 200
-- Tanpa index ini, setiap kali buka tab laporan terjadi full table scan + sort.
-- Dengan index DESC, PostgreSQL langsung baca baris terbaru tanpa sort.

create index if not exists idx_activity_logs_timestamp
  on public.admin_activity_logs(action_timestamp desc);