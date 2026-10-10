-- No-show: the student did not come to a session and it was not cancelled. The teacher assigned to the
-- session marks it from /teacher (the No-show button beside Write note, or in Therapy notes > Awaiting a
-- note) and can undo it.
--
-- This adds the 'no_show' session status and lets a teacher set it on her own accepted session, and take
-- it back. A no-show is not a completed session: it is not billed, earns no commission, and the child's
-- need for the month is open again. The Billing > Therapy page counts the no-shows.
--
-- The app can be deployed before this runs: the No-show buttons stay hidden until the status exists.
--
-- Run the whole file once. Safe to re-run.

ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'no_show';

-- The teacher rule from schema.sql, widened by one status. It compares the status as text so this file can
-- add the status and use it in one run (Postgres refuses to use a new enum value, as an enum, in the same
-- transaction that adds it).
DROP POLICY IF EXISTS "session_plans teacher updates own" ON session_plans;
CREATE POLICY "session_plans teacher updates own" ON session_plans
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid() AND status::text IN ('pending', 'accepted', 'no_show'))
  WITH CHECK (teacher_id = auth.uid() AND status::text IN ('accepted', 'completed', 'declined', 'no_show'));
