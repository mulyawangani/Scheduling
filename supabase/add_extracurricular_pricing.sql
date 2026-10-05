-- Extracurricular activities: monthly price + admin management.
-- Run in Supabase SQL editor. Safe to re-run.
--
-- extracurricular_activities and student_extracurriculars already exist in the
-- live database (they were created outside this repo). This file only adds what
-- the /admin/extracurricular page needs.

-- 0. Reference definition. No-op where the table already exists.
CREATE TABLE IF NOT EXISTS extracurricular_activities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1. Monthly price in IDR (NULL = not set yet), same money type as billing.
ALTER TABLE extracurricular_activities
  ADD COLUMN IF NOT EXISTS monthly_price numeric(12, 2)
  CHECK (monthly_price IS NULL OR monthly_price >= 0);

-- 2. Row level security.
--    Everyone signed in can read every activity (a parent's existing sign-up still
--    needs to show its name after an admin hides the activity). Only owner/admin
--    can add, rename, price or hide them. The parent sign-up list filters on
--    is_active itself.
ALTER TABLE extracurricular_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extracurricular_activities read" ON extracurricular_activities;
CREATE POLICY "extracurricular_activities read" ON extracurricular_activities
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "extracurricular_activities staff manage" ON extracurricular_activities;
CREATE POLICY "extracurricular_activities staff manage" ON extracurricular_activities
  FOR ALL TO authenticated
  USING (has_role('owner') OR has_role('admin'))
  WITH CHECK (has_role('owner') OR has_role('admin'));

-- 3. Let owner/admin read every sign-up (the Enrollment page lists them per child).
--    Read-only and additive: parents' existing access to their own children's rows
--    is not touched, and row level security on this table is left as it is.
DROP POLICY IF EXISTS "student_extracurriculars staff read" ON student_extracurriculars;
CREATE POLICY "student_extracurriculars staff read" ON student_extracurriculars
  FOR SELECT TO authenticated
  USING (has_role('owner') OR has_role('admin'));
