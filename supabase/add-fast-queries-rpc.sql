-- ==========================================
-- Fast queries — Postgres RPC (pre-planned SQL)
--
-- Mengapa:
--   PostgREST (yang dipakai supabase-js) meng-kompilasi query setiap request
--   tanpa reuse prepared statement. Fungsi RPC ini di-pre-plan Postgres →
--   eksekusi lebih cepat, plus mengurangi round-trip client (3 query → 1).
--
-- Fungsi:
--   1. get_admin_dashboard      → data dashboard admin (today, activeIds, chart)
--   2. get_employee_recent      → riwayat terakhir karyawan (dashboard karyawan)
--   3. get_reports_attendance   → data laporan admin
--
-- Keamanan:
--   - security definer + set search_path = public
--   - tipe parameter di-whitelist (uuid/date/int)
--   - grant execute HANYA ke authenticated; revoke dari anon/public
--   - fungsi bersifat read-only (SELECT) → aman
--
-- Cara pakai:
--   Buka Supabase → SQL Editor → tempel & jalankan seluruh file ini.
-- ==========================================

-- 1. Dashboard admin: gabungkan 3 query jadi 1 round-trip.
--    Semantik SAMA dengan query lama di AdminDashboard.tsx:
--      a) absen hari ini   (user_id, status)
--      b) karyawan aktif   (id) — filter cabang optional
--      c) chart rentang    (date, status, user_id)
create or replace function public.get_admin_dashboard(
  p_today date,
  p_start date,
  p_end date,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_today jsonb;
  v_active jsonb;
  v_chart jsonb;
begin
  -- a) Absensi hari ini
  select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'status', status)), '[]'::jsonb)
  into v_today
  from public.attendance_records
  where date = p_today;

  -- b) Karyawan aktif (filter cabang jika diberikan)
  if p_location_id is null then
    select coalesce(jsonb_agg(id), '[]'::jsonb)
    into v_active
    from public.users
    where role = 'employee' and status = 'active';
  else
    select coalesce(jsonb_agg(id), '[]'::jsonb)
    into v_active
    from public.users
    where role = 'employee' and status = 'active'
      and location_id = p_location_id;
  end if;

  -- c) Chart rentang tanggal
  select coalesce(
    jsonb_agg(jsonb_build_object('date', date, 'status', status, 'user_id', user_id)),
    '[]'::jsonb
  )
  into v_chart
  from public.attendance_records
  where date between p_start and p_end;

  return jsonb_build_object(
    'today', v_today,
    'activeIds', v_active,
    'chart', v_chart
  );
end;
$$;

revoke all on function public.get_admin_dashboard(date, date, date, uuid) from public;
revoke all on function public.get_admin_dashboard(date, date, date, uuid) from anon;
grant execute on function public.get_admin_dashboard(date, date, date, uuid) to authenticated;

-- 2. Riwayat terakhir karyawan (dashboard karyawan).
--    Mengganti query `dashboard:recent:{userId}` di EmployeeDashboard.tsx.
create or replace function public.get_employee_recent(
  p_user_id uuid,
  p_limit int default 2
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'user_id', user_id,
        'date', date,
        'time_in', time_in,
        'time_out', time_out,
        'status', status,
        'photo_url', photo_url,
        'is_forgot_clock_out', is_forgot_clock_out
      )
      order by date desc
    ),
    '[]'::jsonb
  )
  from (
    select id, user_id, date, time_in, time_out, status, photo_url, is_forgot_clock_out
    from public.attendance_records
    where user_id = p_user_id
    order by date desc
    limit greatest(0, least(p_limit, 100))
  ) t;
$$;

revoke all on function public.get_employee_recent(uuid, int) from public;
revoke all on function public.get_employee_recent(uuid, int) from anon;
grant execute on function public.get_employee_recent(uuid, int) to authenticated;

-- 3. Data laporan admin (query paling berat: ORDER BY date DESC LIMIT 200).
--    Mengganti query `reports:attendance:{filter}` di AdminReports.tsx.
create or replace function public.get_reports_attendance(
  p_start date default null,
  p_end date default null,
  p_limit int default 200
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'user_id', user_id,
        'date', date,
        'time_in', time_in,
        'time_out', time_out,
        'status', status,
        'location_lat', location_lat,
        'location_lng', location_lng,
        'photo_url', photo_url,
        'is_forgot_clock_out', is_forgot_clock_out,
        'face_match_score', face_match_score,
        'liveness_passed', liveness_passed,
        'is_suspicious', is_suspicious
      )
      order by date desc
    ),
    '[]'::jsonb
  )
  from (
    select id, user_id, date, time_in, time_out, status,
           location_lat, location_lng, photo_url,
           is_forgot_clock_out, face_match_score, liveness_passed, is_suspicious
    from public.attendance_records
    where (p_start is null or date >= p_start)
      and (p_end is null or date <= p_end)
    order by date desc
    limit greatest(0, least(p_limit, 500))
  ) t;
$$;

revoke all on function public.get_reports_attendance(date, date, int) from public;
revoke all on function public.get_reports_attendance(date, date, int) from anon;
grant execute on function public.get_reports_attendance(date, date, int) to authenticated;
