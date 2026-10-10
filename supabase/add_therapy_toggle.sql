-- Every child has two separate settings: a school status (None, Trial, Non-student, Student, Inactive)
-- and a therapy switch (on or off). They do not depend on each other: a Trial child can be on therapy,
-- and so can an Inactive one (a graduated student who keeps having therapy). Scheduling, therapy
-- billing and the Owner dashboard follow the therapy switch, not the school status.
--
-- Only an Owner or Admin can switch therapy; the trigger below refuses a parent, including when a
-- parent adds a child (a new child starts with therapy off until staff turn it on).
--
-- Starting point, applied once when the column is added: therapy is ON for every child who is
-- scheduled for therapy today (has a protocol need or a booked session) and is not Inactive, so
-- nothing changes in what gets scheduled. Everyone else starts OFF. Re-running this file does not
-- touch the switches again.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'therapy_on'
  ) THEN
    ALTER TABLE students ADD COLUMN therapy_on boolean NOT NULL DEFAULT false;

    UPDATE students s
    SET therapy_on = true
    WHERE s.status IS DISTINCT FROM 'inactive'
      AND (
        EXISTS (SELECT 1 FROM student_protocols sp WHERE sp.student_id = s.id)
        OR EXISTS (
          SELECT 1 FROM session_plans p
          WHERE p.student_id = s.id AND p.status IN ('pending', 'accepted', 'completed')
        )
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION guard_student_therapy_toggle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- No signed-in user: the SQL editor, the service role, migrations and the sign-up action.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF has_role('owner') OR has_role('admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.therapy_on THEN
      RAISE EXCEPTION 'Only an owner or admin can turn therapy on.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.therapy_on IS DISTINCT FROM OLD.therapy_on THEN
    RAISE EXCEPTION 'Only an owner or admin can turn therapy on or off.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_guard_therapy_toggle ON students;
CREATE TRIGGER students_guard_therapy_toggle
  BEFORE INSERT OR UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION guard_student_therapy_toggle();
