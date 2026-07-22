-- =============================================
-- CLEANUP: Remove seed auth users
-- Run this FIRST to delete the broken users
-- created by the old seed.sql
-- =============================================

-- Delete attendance records first (foreign keys)
delete from public.attendance_records
where user_id in (select id from auth.users where email like '%@geoface.com');

-- Delete activity logs
delete from public.admin_activity_logs
where admin_id in (select id from auth.users where email like '%@geoface.com');

-- Delete public user profiles
delete from public.users
where id in (select id from auth.users where email like '%@geoface.com');

-- Delete auth users themselves
delete from auth.users
where email like '%@geoface.com';
