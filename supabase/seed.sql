-- ============================================================
-- SEED DATA untuk Absensi Digital Geoface
-- Jalankan SETELAH schema.sql di Supabase SQL Editor
-- ============================================================

-- ─── SEMENTARA: lepas FK auth.users agar bisa insert user dummy ───
-- (akan dipasang kembali di akhir script)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- ─── OFFICE LOCATIONS ───
INSERT INTO public.office_locations (id, name, address, lat, lng, radius) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Kantor Pusat Surabaya',  'Jl. Tunjungan No.1, Surabaya',            -7.250445, 112.768845, 100),
  ('a0000000-0000-0000-0000-000000000002', 'Cabang Sidoarjo',        'Jl. Diponegoro No.10, Sidoarjo',          -7.445214, 112.716186, 200),
  ('a0000000-0000-0000-0000-000000000003', 'Test Location',          'Surabaya, Jawa Timur',                    -7.307081, 112.692283, 150)
ON CONFLICT (id) DO NOTHING;

-- ─── USERS (profile only — password via Supabase Auth) ───
INSERT INTO public.users (id, name, role, status, position, division, age, location_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Budi Santoso',      'employee', 'active',  'Staf Administrasi', 'Administrasi', 28, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Siti Aminah',       'employee', 'active',  'Tim Marketing',     'Marketing',    25, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', 'Agus Pratama',      'employee', 'active',  'Teknisi Lapangan',  'Teknisi',      32, 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000004', 'Rina Melati',       'employee', 'active',  'Staf Keuangan',     'Keuangan',     29, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000005', 'Joko Widodo',       'employee', 'active',  'Teknisi Lapangan',  'Teknisi',      35, 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000006', 'Rudi Hermawan',     'employee', 'active',  'Customer Service',  'Layanan',      27, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000007', 'Maya Sari',         'employee', 'active',  'HR Staff',          'SDM',          31, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000008', 'Bambang Pamungkas', 'employee', 'active',  'Security',          'Keamanan',     40, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000009', 'Diana Putri',       'employee', 'active',  'Staf IT',           'IT',           26, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-00000000000a', 'Andi Saputra',      'employee', 'active',  'Kurir',             'Logistik',     30, 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-00000000000b', 'Nina Wati',         'employee', 'active',  'Sales',             'Penjualan',    28, 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-00000000000c', 'Eko Prasetyo',      'employee', 'active',  'Gudang',            'Logistik',     33, 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-00000000000d', 'Dewi Lestari',      'employee', 'active',  'Admin Gudang',      'Logistik',     29, 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-00000000000e', 'Fajar Nugraha',     'employee', 'active',  'Quality Control',   'QC',           34, 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-00000000000f', 'Ahmad Dahlan',      'employee', 'active',  'Staf Tester',       'IT',           27, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'Admin HRD',         'admin',    'active',  'HR Manager',        NULL,           NULL,'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ─── ATTENDANCE RECORDS ───
-- Membangkitkan 30 hari ke belakang dengan pseudo-random status.
DO $$
DECLARE
  day_offset INTEGER;
  i INTEGER;
  uid UUID;
  uname TEXT;
  uloc UUID;
  uloc_lat DOUBLE PRECISION;
  uloc_lng DOUBLE PRECISION;
  status_val TEXT;
  seed_val INTEGER;
  dow INTEGER;
  today_date DATE := '2026-07-22'::date;
  cur_date DATE;
  hour_int INTEGER;
  min_int INTEGER;
  has_photo BOOLEAN;

  -- data karyawan (indeks 1–15)
  emp_ids   UUID[] := ARRAY[
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000005',
    'b0000000-0000-0000-0000-000000000006',
    'b0000000-0000-0000-0000-000000000007',
    'b0000000-0000-0000-0000-000000000008',
    'b0000000-0000-0000-0000-000000000009',
    'b0000000-0000-0000-0000-00000000000a',
    'b0000000-0000-0000-0000-00000000000b',
    'b0000000-0000-0000-0000-00000000000c',
    'b0000000-0000-0000-0000-00000000000d',
    'b0000000-0000-0000-0000-00000000000e',
    'b0000000-0000-0000-0000-00000000000f'
  ];
  emp_names TEXT[] := ARRAY[
    'Budi Santoso','Siti Aminah','Agus Pratama','Rina Melati',
    'Joko Widodo','Rudi Hermawan','Maya Sari','Bambang Pamungkas',
    'Diana Putri','Andi Saputra','Nina Wati','Eko Prasetyo',
    'Dewi Lestari','Fajar Nugraha','Ahmad Dahlan'
  ];
  emp_loc_ids UUID[] := ARRAY[
    'a0000000-0000-0000-0000-000000000001',  -- Budi     → Surabaya
    'a0000000-0000-0000-0000-000000000001',  -- Siti     → Surabaya
    'a0000000-0000-0000-0000-000000000002',  -- Agus     → Sidoarjo
    'a0000000-0000-0000-0000-000000000001',  -- Rina     → Surabaya
    'a0000000-0000-0000-0000-000000000002',  -- Joko     → Sidoarjo
    'a0000000-0000-0000-0000-000000000001',  -- Rudi     → Surabaya
    'a0000000-0000-0000-0000-000000000001',  -- Maya     → Surabaya
    'a0000000-0000-0000-0000-000000000001',  -- Bambang  → Surabaya
    'a0000000-0000-0000-0000-000000000001',  -- Diana    → Surabaya
    'a0000000-0000-0000-0000-000000000002',  -- Andi     → Sidoarjo
    'a0000000-0000-0000-0000-000000000002',  -- Nina     → Sidoarjo
    'a0000000-0000-0000-0000-000000000002',  -- Eko      → Sidoarjo
    'a0000000-0000-0000-0000-000000000002',  -- Dewi     → Sidoarjo
    'a0000000-0000-0000-0000-000000000002',  -- Fajar    → Sidoarjo
    'a0000000-0000-0000-0000-000000000001'   -- Ahmad    → Surabaya
  ];
BEGIN
  FOR day_offset IN -29..0 LOOP
    cur_date := today_date + day_offset;
    dow := EXTRACT(DOW FROM cur_date);
    CONTINUE WHEN dow = 0; -- skip Minggu

    FOR i IN 1..array_length(emp_ids, 1) LOOP
      uid := emp_ids[i];
      uname := emp_names[i];
      uloc := emp_loc_ids[i];

      -- koordinat sesuai lokasi
      IF uloc = 'a0000000-0000-0000-0000-000000000002' THEN
        uloc_lat := -7.445214;
        uloc_lng := 112.716186;
      ELSIF uloc = 'a0000000-0000-0000-0000-000000000003' THEN
        uloc_lat := -7.307081;
        uloc_lng := 112.692283;
      ELSE
        uloc_lat := -7.250445;
        uloc_lng := 112.768845;
      END IF;

      seed_val := MOD(i * 17 + (day_offset + 100) * 31, 23);

      -- ── Tentukan status ──
      IF dow = 6 AND MOD(seed_val, 5) = 0 THEN
        status_val := 'telat';            -- Sabtu: kadang telat
      ELSIF dow = 1 AND MOD(seed_val, 11) = 0 THEN
        status_val := 'alpha';            -- Senin: kadang alpha
      ELSIF i = 4 AND MOD(seed_val, 13) = 0 THEN
        status_val := 'cuti';             -- Rina (indeks 4) sering cuti
      ELSIF seed_val < 3 THEN
        status_val := 'alpha';
      ELSIF seed_val < 8 THEN
        status_val := 'telat';
      ELSIF seed_val = 22 THEN
        status_val := 'cuti';
      ELSE
        status_val := 'hadir';
      END IF;

      -- ── Hitung jam check-in (untuk semua status) ──
      -- MOD di PG bisa negatif utk input negatif, maka pakai ((x % y) + y) % y
      hour_int := 7 + ((i * 3 + day_offset * 7) % 3 + 3) % 3;      -- 07:00 – 09:00
      min_int  := ((i * 5 + day_offset * 11) % 60 + 60) % 60;
      IF status_val = 'telat' THEN
        hour_int := hour_int + 1;                                    -- telat: +1 jam
      END IF;
      IF status_val IN ('alpha', 'cuti') THEN
        hour_int := 0;                                                -- dummy: midnight
        min_int  := 0;
      END IF;

      -- foto: 3 hari terakhir, 60% probabilitas
      has_photo := (day_offset >= -2) AND (MOD(i * 13 + day_offset, 100) > 40);

      INSERT INTO public.attendance_records (
        user_id, date, time_in, status,
        location_lat, location_lng, photo_url
      ) VALUES (
        uid, cur_date,
        make_time(hour_int, min_int, 0)::time,
        status_val::attendance_status,
        uloc_lat,                        -- selalu pakai lokasi kantor masing-masing
        uloc_lng,
        CASE WHEN has_photo THEN
          (ARRAY[
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fit=crop&w=150&q=80',
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fit=crop&w=150&q=80'
          ])[1 + MOD(i, 2)]
        ELSE NULL END
      ) ON CONFLICT (user_id, date) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ─── ADMIN ACTIVITY LOGS (hardcoded against fixed date) ───
INSERT INTO public.admin_activity_logs (admin_id, action, action_timestamp, location_lat, location_lng, location_name) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Menyetujui pendaftaran akun: Siti Aminah',          '2026-07-22 01:03:54+00'::timestamptz,   -7.250445, 112.768845, 'Kantor Pusat Surabaya'),
  ('c0000000-0000-0000-0000-000000000001', 'Mengubah status absensi Budi Santoso menjadi Telat', '2026-07-21 22:03:54+00'::timestamptz,   -7.250445, 112.768845, 'Kantor Pusat Surabaya'),
  ('c0000000-0000-0000-0000-000000000001', 'Mengekspor data laporan absensi bulan Juli',         '2026-07-21 03:03:54+00'::timestamptz,   -7.250445, 112.768845, 'Kantor Pusat Surabaya'),
  ('c0000000-0000-0000-0000-000000000001', 'Menambahkan lokasi baru: Cabang Malang',             '2026-07-20 03:03:54+00'::timestamptz,   -7.250445, 112.768845, 'Kantor Pusat Surabaya'),
  ('c0000000-0000-0000-0000-000000000001', 'Menghapus akun karyawan: Test User',                 '2026-07-19 03:03:54+00'::timestamptz,   -7.250445, 112.768845, 'Kantor Pusat Surabaya'),
  ('c0000000-0000-0000-0000-000000000001', 'Mengubah data akun Agus Pratama',                    '2026-07-18 03:03:54+00'::timestamptz,   -7.445214, 112.716186, 'Cabang Sidoarjo'),
  ('c0000000-0000-0000-0000-000000000001', 'Menyetujui pendaftaran akun: Ahmad Dahlan',          '2026-07-17 03:03:54+00'::timestamptz,   -7.250445, 112.768845, 'Kantor Pusat Surabaya')
ON CONFLICT DO NOTHING;

-- ─── FK AUTH.USERS TIDAK DIPASANG KEMBALI ───
-- Seed ini insert user dummy ke public.users (tanpa entry di auth.users).
-- Memasang FK ke auth.users akan gagal karena user dummy tidak ada di tabel auth.
-- Untuk development/demo, FK tetap drop — schema.sql akan memasangnya
-- ketika user asli dibuat via trigger handle_new_user().
