-- ==========================================
-- Migration: Add face_match_score to attendance_records
-- Menyimpan skor kecocokan wajah untuk deteksi
-- absen mencurigakan oleh admin.
-- ==========================================

-- Kolom opsional: NULL = belum dicek, 0 = cocok sempurna, >threshold = mencurigakan
do $$ begin
  alter table public.attendance_records
    add column face_match_score double precision;
exception when duplicate_column then null;
end $$;

-- Index untuk admin filtering
create index if not exists idx_attendance_face_match
  on public.attendance_records(face_match_score)
  where face_match_score is not null;
