-- Billing rates were readable by every signed-in user, parents and the Principal
-- included. The rule "billing_rates teacher reads relevant" (schema.sql) compares only
-- teacher_id with the signed-in user or null, and never checks the role, so each child's
-- default billing and commission rate (the rows with no teacher) was open to anyone with
-- a login, and sign-up is open.
--
-- It now applies to teachers only: a teacher still reads their own rate rows plus each
-- child's default row, which the Commissions tab needs. Owner and Admin keep their own
-- full-access rules. Nobody else can read rates.
--
-- Safe to re-run.

DROP POLICY IF EXISTS "billing_rates teacher reads relevant" ON billing_rates;
CREATE POLICY "billing_rates teacher reads relevant" ON billing_rates
  FOR SELECT TO authenticated
  USING (has_role('teacher') AND (teacher_id = auth.uid() OR teacher_id IS NULL));
