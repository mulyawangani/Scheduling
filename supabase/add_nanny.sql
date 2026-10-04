-- Nanny persona setup
-- Run in Supabase SQL editor (ywvabwboqazialrlwwbe)

-- 1. Add 'nanny' to role enum (if profiles.role is a text column with check constraint, update that instead)
-- If you get an error here, your role column may use a text check constraint — skip and go to step 2.
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'nanny';
EXCEPTION WHEN undefined_object THEN
  -- role is not an enum type; assume text column, no action needed
  RAISE NOTICE 'user_role is not an enum; skipping ADD VALUE';
END $$;

-- 2. Extend attendance_records with nanny check-in fields
--    (non-destructive: only adds columns if they don't exist)
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS check_in_at  timestamptz,
  ADD COLUMN IF NOT EXISTS check_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS temperature  numeric(4,1),
  ADD COLUMN IF NOT EXISTS recorded_by  uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Create behavior_logs table
CREATE TABLE IF NOT EXISTS behavior_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id        uuid NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  recorded_by_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date             date NOT NULL DEFAULT CURRENT_DATE,
  type             text NOT NULL CHECK (type IN ('behavior', 'hygiene', 'health', 'milestone')),
  severity         text CHECK (severity IN ('low', 'medium', 'high')),
  description      text NOT NULL,
  other_student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE behavior_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nanny_own_behavior_logs" ON behavior_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('nanny'))
  AND recorded_by_id = auth.uid()
);
CREATE POLICY "staff_read_behavior_logs" ON behavior_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'teacher'))
);
CREATE POLICY "staff_manage_behavior_logs" ON behavior_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);

-- 4. attendance_records already has "staff_manage_attendance" that includes 'nanny' (see add_enrollments.sql)
--    No new attendance policy needed.

-- 5. Index for fast per-date lookups
CREATE INDEX IF NOT EXISTS idx_behavior_logs_school_date ON behavior_logs (school_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records (date);
