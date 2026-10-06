-- Parents can edit their own child's personal details, but not the fields the
-- school controls. Row level security can't compare old and new values, so a
-- parent could otherwise change these through the API even though the app never
-- shows them (same approach as prevent_role_self_escalation on profiles).
--
-- Admin-controlled fields on `students`:
--   status (a parent may only move a child to 'inactive'), rate_per_session,
--   priority, weekly_target_sessions, therapy_location_id, classroom_id, parent_id.
-- New children from a parent must start as 'trial' (or no status) with no rate,
-- priority or classroom. weekly_target_sessions and therapy_location_id have
-- column defaults, so they can only be locked after a child exists.
--
-- Owner and admin are unrestricted. Requests with no signed-in user (SQL editor,
-- service role, migrations, the sign-up server action) are left alone.
--
-- To undo:
--   DROP TRIGGER students_guard_admin_fields ON students;
--   DROP FUNCTION guard_student_admin_fields();
-- Safe to re-run.

CREATE OR REPLACE FUNCTION guard_student_admin_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF has_role('owner') OR has_role('admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF (NEW.status IS NOT NULL AND NEW.status <> 'trial')
       OR NEW.rate_per_session IS NOT NULL
       OR NEW.priority IS NOT NULL
       OR NEW.classroom_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only an owner or admin can set status, rate, priority or classroom.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.parent_id IS DISTINCT FROM OLD.parent_id
     OR NEW.rate_per_session IS DISTINCT FROM OLD.rate_per_session
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.weekly_target_sessions IS DISTINCT FROM OLD.weekly_target_sessions
     OR NEW.therapy_location_id IS DISTINCT FROM OLD.therapy_location_id
     OR NEW.classroom_id IS DISTINCT FROM OLD.classroom_id
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IS DISTINCT FROM 'inactive') THEN
    RAISE EXCEPTION 'Only an owner or admin can change status, rate, priority, weekly sessions, location or classroom.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_guard_admin_fields ON students;
CREATE TRIGGER students_guard_admin_fields
  BEFORE INSERT OR UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION guard_student_admin_fields();
