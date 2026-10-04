-- Add 'trial' as a valid student status
-- Run in Supabase SQL editor (ywvabwboqazialrlwwbe)

-- Drop and recreate the check constraint to include 'trial'
ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_status_check;

ALTER TABLE students
  ADD CONSTRAINT students_status_check
  CHECK (status IS NULL OR status IN ('student', 'non_student', 'inactive', 'trial'));

-- Update schema comment for reference
COMMENT ON COLUMN students.status IS
  'trial: new registration (default); student: enrolled in classroom; non_student: therapy-only; inactive: paused. Only admin/owner can promote from trial.';
