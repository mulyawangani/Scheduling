-- Nanny role: read access the nanny pages need but never had.
-- Until now only owner/admin/teacher/parent could read `students`, so a real
-- nanny login saw empty classrooms, no check-in list and no student names.
-- Safe to re-run.

-- 1. Active students (status = 'student') - the same set the check-in board uses.
--    has_role() is SECURITY DEFINER. Do not swap it for an inline SELECT on
--    profiles: the "parent reads assigned teacher profile" policy reads students,
--    so the two policies would recurse.
DROP POLICY IF EXISTS "students nanny reads active" ON students;
CREATE POLICY "students nanny reads active" ON students
  FOR SELECT TO authenticated
  USING (has_role('nanny') AND status = 'student');

-- 2. Teacher names for the Behavior Log "other teacher" picker.
DROP POLICY IF EXISTS "profiles nanny reads teachers" ON profiles;
CREATE POLICY "profiles nanny reads teachers" ON profiles
  FOR SELECT TO authenticated
  USING (has_role('nanny') AND role = 'teacher');
