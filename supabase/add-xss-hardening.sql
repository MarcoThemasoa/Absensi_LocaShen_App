-- ==========================================
-- XSS hardening — batas panjang input + trim di server
--
-- Tujuan:
--   Pertahanan berlapis terhadap stored XSS. React sudah auto-escape di
--   client, tapi di server kita juga batasi & bersihkan input agar data
--   yang masuk DB selalu wajar (tidak bisa diisi string HTML raksasa).
--
-- Perubahan:
--   1. CHECK constraint panjang: users.name / division / position
--   2. CHECK constraint panjang: admin_notifications.message / device_label
--   3. Trim + cap panjang di handle_new_user (registrasi)
--   4. Trim + cap panjang di notify_admin (pesan notifikasi)
--
-- Cara pakai:
--   Buka Supabase → SQL Editor → tempel & jalankan seluruh file ini.
-- ==========================================

-- 1. CHECK constraint panjang kolom user (idempotent)
do $$ begin
  alter table public.users
    add constraint chk_users_name_len check (char_length(name) <= 120);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.users
    add constraint chk_users_division_len check (division is null or char_length(division) <= 80);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.users
    add constraint chk_users_position_len check (position is null or char_length(position) <= 80);
exception when duplicate_object then null;
end $$;

-- 2. CHECK constraint panjang notifikasi (idempotent)
do $$ begin
  alter table public.admin_notifications
    add constraint chk_notif_message_len check (char_length(message) <= 500);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.admin_notifications
    add constraint chk_notif_device_label_len check (device_label is null or char_length(device_label) <= 200);
exception when duplicate_object then null;
end $$;

-- 3. Harden handle_new_user: trim + buang karakter kontrol + cap panjang
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_division text;
  v_position text;
  v_age int;
  v_location_id uuid;
begin
  -- Trim & buang karakter kontrol (\x00-\x1F) dari input metadata
  v_name := regexp_replace(
    coalesce(nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''), split_part(new.email, '@', 1)),
    '[\u0000-\u001f\u007f]', '', 'g'
  );
  v_name := left(v_name, 120);

  v_division := regexp_replace(btrim(coalesce(new.raw_user_meta_data->>'division', '')), '[\u0000-\u001f\u007f]', '', 'g');
  v_division := left(nullif(v_division, ''), 80);

  v_position := regexp_replace(btrim(coalesce(new.raw_user_meta_data->>'position', '')), '[\u0000-\u001f\u007f]', '', 'g');
  v_position := left(nullif(v_position, ''), 80);

  -- Age: parse aman — tolak nilai non-angka / di luar rentang
  begin
    v_age := (new.raw_user_meta_data->>'age')::int;
    if v_age < 1 or v_age > 119 then
      v_age := null;
    end if;
  exception when others then
    v_age := null;
  end;

  -- location_id: parse aman — tolak uuid tidak valid
  begin
    v_location_id := (new.raw_user_meta_data->>'location_id')::uuid;
  exception when others then
    v_location_id := null;
  end;

  insert into public.users (id, name, email, role, status, division, position, age, location_id)
  values (
    new.id,
    v_name,
    new.email,
    'employee',
    'pending',
    v_division,
    v_position,
    v_age,
    v_location_id
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Lock down: trigger-only function
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;

-- 4. Harden notify_admin: trim + cap panjang pesan/device_label
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
declare
  v_message text;
  v_label text;
begin
  -- Hanya terima tipe yang dikenal — tolak input liar dari client
  if p_type not in ('device_change', 'late_checkin') then
    raise exception 'unknown notification type: %', p_type;
  end if;

  -- Bersihkan & batasi panjang pesan
  v_message := regexp_replace(btrim(coalesce(p_message, '')), '[\u0000-\u001f\u007f]', '', 'g');
  v_message := left(nullif(v_message, ''), 500);

  v_label := nullif(btrim(coalesce(p_device_label, '')), '');
  v_label := left(v_label, 200);

  insert into public.admin_notifications (type, user_id, message, device_label)
  values (p_type, p_user_id, v_message, v_label);
end;
$$;

-- Jangan biarkan anon/publik mengekspos function ini
revoke all on function public.notify_admin(text, uuid, text, text) from public;
revoke all on function public.notify_admin(text, uuid, text, text) from anon;
grant execute on function public.notify_admin(text, uuid, text, text) to authenticated;
