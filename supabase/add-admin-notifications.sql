-- ==========================================
-- admin_notifications — notifikasi langsung ke admin
--
-- Dua jenis notifikasi:
--   1. 'device_change' — karyawan login/absen dari perangkat berbeda
--      (indikasi kredensial dipakai orang lain / "dititipkan").
--   2. 'late_checkin'  — karyawan absen masuk di atas jam 12:00.
--
-- Keamanan:
--   Karyawan TIDAK boleh insert langsung (RLS blokir semua insert).
--   Satu-satunya jalan masuk adalah RPC notify_admin() di bawah, yang
--   dijalankan dengan security definer (privilege tabel owner) sehingga
--   bisa menulis notifikasi meskipun RLS menolak insert oleh user biasa.
-- ==========================================

create table if not exists public.admin_notifications (
  id uuid default gen_random_uuid() primary key,
  type text not null,                            -- 'device_change' | 'late_checkin'
  user_id uuid references public.users(id),      -- karyawan terkait (nullable, defensif)
  message text not null,                         -- pesan siap tampil
  device_label text,                             -- label perangkat (khusus device_change)
  created_at timestamptz default timezone('utc'::text, now()) not null,
  read_at timestamptz                            -- belum dibaca = null
);

-- Index untuk query "48 jam terakhir" di dashboard + filter log
create index if not exists idx_admin_notifications_created
  on public.admin_notifications(created_at desc);

create index if not exists idx_admin_notifications_user
  on public.admin_notifications(user_id);

alter table public.admin_notifications enable row level security;

-- RLS: hanya admin yang bisa melihat notifikasi
drop policy if exists "Admins can view all notifications" on public.admin_notifications;
create policy "Admins can view all notifications"
  on public.admin_notifications
  for select
  using ( public.is_admin() );

-- RPC untuk menulis notifikasi (security definer — karyawan bisa panggil,
-- tapi insert dieksekusi sebagai pemilik tabel, bukan sebagai user login).
create or replace function public.notify_admin(
  p_type text,
  p_user_id uuid,
  p_message text,
  p_device_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Hanya terima tipe yang dikenal — tolak input liar dari client
  if p_type not in ('device_change', 'late_checkin') then
    raise exception 'unknown notification type: %', p_type;
  end if;

  insert into public.admin_notifications (type, user_id, message, device_label)
  values (p_type, p_user_id, p_message, p_device_label);
end;
$$;

-- Jangan biarkan anon/publik mengekspos function ini
revoke all on function public.notify_admin(text, uuid, text, text) from public;
revoke all on function public.notify_admin(text, uuid, text, text) from anon;
grant execute on function public.notify_admin(text, uuid, text, text) to authenticated;
