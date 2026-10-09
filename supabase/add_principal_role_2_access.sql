-- Principal role, step 2 of 2. Run after add_principal_role_1_enum.sql, in a new query.
--
-- What a Principal may do follows the permission table (src/lib/auth/permissions.ts):
--   read    children, parents, contacts, staff names, sessions, the weekly calendar,
--           enrollment, attendance, teacher availability, therapy notes
--   change  classrooms, and therapy notes (accept or send back)
-- A Principal cannot see billing, rates, announcements or the audit log, and cannot
-- yet edit a child's profile (that needs a rule that limits which fields she may change).
--
-- Safe to re-run: each policy is dropped before it is created.

-- ── Read access ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles principal reads all" ON profiles;
CREATE POLICY "profiles principal reads all" ON profiles
  FOR SELECT TO authenticated USING (has_role('principal'));

DROP POLICY IF EXISTS "students principal reads all" ON students;
CREATE POLICY "students principal reads all" ON students
  FOR SELECT TO authenticated USING (has_role('principal'));

DROP POLICY IF EXISTS "student_contacts principal reads all" ON student_contacts;
CREATE POLICY "student_contacts principal reads all" ON student_contacts
  FOR SELECT TO authenticated USING (has_role('principal'));

DROP POLICY IF EXISTS "student_protocols principal reads all" ON student_protocols;
CREATE POLICY "student_protocols principal reads all" ON student_protocols
  FOR SELECT TO authenticated USING (has_role('principal'));

DROP POLICY IF EXISTS "teacher_availability principal reads all" ON teacher_availability;
CREATE POLICY "teacher_availability principal reads all" ON teacher_availability
  FOR SELECT TO authenticated USING (has_role('principal'));

DROP POLICY IF EXISTS "session_plans principal reads all" ON session_plans;
CREATE POLICY "session_plans principal reads all" ON session_plans
  FOR SELECT TO authenticated USING (has_role('principal'));

DROP POLICY IF EXISTS "session_occurrences principal reads all" ON session_occurrences;
CREATE POLICY "session_occurrences principal reads all" ON session_occurrences
  FOR SELECT TO authenticated USING (has_role('principal'));

DROP POLICY IF EXISTS "enrollments principal reads all" ON enrollments;
CREATE POLICY "enrollments principal reads all" ON enrollments
  FOR SELECT TO authenticated USING (has_role('principal'));

DROP POLICY IF EXISTS "attendance_records principal reads all" ON attendance_records;
CREATE POLICY "attendance_records principal reads all" ON attendance_records
  FOR SELECT TO authenticated USING (has_role('principal'));

DROP POLICY IF EXISTS "calendar_events principal reads all" ON calendar_events;
CREATE POLICY "calendar_events principal reads all" ON calendar_events
  FOR SELECT TO authenticated USING (has_role('principal'));

DROP POLICY IF EXISTS "schools principal reads all" ON schools;
CREATE POLICY "schools principal reads all" ON schools
  FOR SELECT TO authenticated USING (has_role('principal'));

DROP POLICY IF EXISTS "therapy_locations principal reads all" ON therapy_locations;
CREATE POLICY "therapy_locations principal reads all" ON therapy_locations
  FOR SELECT TO authenticated USING (has_role('principal'));

-- ── Classrooms: create, rename, delete, assign ───────────────────────────────
DROP POLICY IF EXISTS "classrooms principal manages" ON classrooms;
CREATE POLICY "classrooms principal manages" ON classrooms
  FOR ALL TO authenticated
  USING (has_role('principal')) WITH CHECK (has_role('principal'));

-- ── Therapy notes: read and review (accept or send back) ─────────────────────
DROP POLICY IF EXISTS "therapy_notes principal reads submitted" ON therapy_notes;
CREATE POLICY "therapy_notes principal reads submitted" ON therapy_notes
  FOR SELECT TO authenticated USING (has_role('principal') AND status <> 'draft');

DROP POLICY IF EXISTS "therapy_notes principal reviews" ON therapy_notes;
CREATE POLICY "therapy_notes principal reviews" ON therapy_notes
  FOR UPDATE TO authenticated
  USING (has_role('principal') AND status <> 'draft')
  WITH CHECK (has_role('principal'));

-- ── Link a login to the Principal role ───────────────────────────────────────
-- Create the login first in the Supabase dashboard: Authentication > Users > Add user
-- (use an email that ends in .com or similar, and set the password there; passwords do
-- not belong in this file). Then run this block with that email.
INSERT INTO profiles (id, role, name, email)
SELECT id, 'principal', 'Demo Principal', email
FROM auth.users
WHERE email = 'demo.principal@playtics.com'
ON CONFLICT (id) DO UPDATE SET role = 'principal';

SELECT p.name, p.email, p.role FROM profiles p WHERE p.role = 'principal';
