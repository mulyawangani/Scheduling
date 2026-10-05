-- Admin can edit children and set their school-hours availability.
-- schema.sql made admin read-only on `students` and `student_availability`, but the
-- admin Children page (Edit profile -> Status = Student, assign classroom) writes to
-- both. A blocked update comes back as "0 rows changed", not an error, which is why
-- the page used to say "Profile saved" when nothing was saved.
-- Creating and deleting children stays owner-only. Safe to re-run.

DROP POLICY IF EXISTS "students admin updates" ON students;
CREATE POLICY "students admin updates" ON students
  FOR UPDATE TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

DROP POLICY IF EXISTS "student_availability admin manages" ON student_availability;
CREATE POLICY "student_availability admin manages" ON student_availability
  FOR ALL TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));
