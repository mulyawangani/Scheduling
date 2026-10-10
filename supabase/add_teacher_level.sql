-- Each teacher's level: senior, junior or intern. The Owner dashboard counts teachers by level
-- (principals are a role of their own, not a level), and the Teachers page gets a Level choice.
--
-- Only the Owner can set it: the trigger refuses a change from anyone else, so a teacher cannot
-- promote themselves through the API (the profiles update rule lets a user edit their own row).
-- Nothing else about teachers changes. The level starts empty ("not set") for everyone.
--
-- Safe to re-run.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS teacher_level text
  CHECK (teacher_level IS NULL OR teacher_level IN ('senior', 'junior', 'intern'));

CREATE OR REPLACE FUNCTION prevent_teacher_level_self_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF new.teacher_level IS DISTINCT FROM old.teacher_level AND NOT has_role('owner') THEN
    RAISE EXCEPTION 'only an owner can change teacher_level';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_teacher_level ON profiles;
CREATE TRIGGER profiles_guard_teacher_level
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_teacher_level_self_change();
