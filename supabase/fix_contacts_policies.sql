-- Fixes two gaps in who can touch a child's parent and emergency contacts
-- (student_contacts). Safe to re-run.
--
-- 1. Parents could add contacts but not change them: there was no update rule, so
--    editing an existing contact on the Profile tab silently did nothing while the
--    page said "Saved". Parents may now update contacts of their own children.
--
-- 2. The read rule let EVERY teacher read EVERY child's contacts. Teachers now read
--    only the contacts of children they teach. Owner and Admin still read all.
--    (Principal reads all through add_principal_role_2_access.sql.)

DROP POLICY IF EXISTS "parents update own student_contacts" ON student_contacts;
CREATE POLICY "parents update own student_contacts" ON student_contacts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = student_contacts.student_id
        AND students.parent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = student_contacts.student_id
        AND students.parent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "staff can read student_contacts" ON student_contacts;
CREATE POLICY "staff can read student_contacts" ON student_contacts
  FOR SELECT TO authenticated
  USING (has_role('owner') OR has_role('admin'));

DROP POLICY IF EXISTS "teachers read assigned student_contacts" ON student_contacts;
CREATE POLICY "teachers read assigned student_contacts" ON student_contacts
  FOR SELECT TO authenticated
  USING (has_role('teacher') AND is_teacher_of_student(student_id));
