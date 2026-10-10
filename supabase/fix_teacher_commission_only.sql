-- A teacher needs to know what they earn, not what the school bills. Until now a teacher could
-- read the billing_rates rows for their own children (their own rows plus each child's default
-- row), which includes billing_rate, the amount charged to the family. That is more than the
-- Commissions tab needs.
--
-- This adds my_commission_rates(): it returns, for the signed-in teacher, one commission amount
-- per child they teach (their own rate for that child if the owner set one, otherwise the child's
-- default) and nothing else about the rates. It then removes the teacher's direct read on
-- billing_rates, so billing rates are readable by the Owner and Admin only.
--
-- Commission can differ per child (and per teacher for a child); that is already how
-- billing_rates stores it, so nothing about how the Owner sets rates changes.
--
-- Run the whole file once. Safe to re-run. The app falls back to the old way of reading until
-- this has run, so the order of deploy and SQL does not matter.

CREATE OR REPLACE FUNCTION my_commission_rates()
RETURNS TABLE (student_id uuid, commission_rate numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT ON (br.student_id) br.student_id, br.commission_rate
  FROM billing_rates br
  WHERE (br.teacher_id = auth.uid() OR br.teacher_id IS NULL)
    AND is_teacher_of_student(br.student_id)
  ORDER BY br.student_id, (br.teacher_id IS NULL)
$$;

REVOKE ALL ON FUNCTION my_commission_rates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION my_commission_rates() FROM anon;
GRANT EXECUTE ON FUNCTION my_commission_rates() TO authenticated;

-- Teachers no longer read billing_rates directly. Owner and Admin keep their own full-access rules.
DROP POLICY IF EXISTS "billing_rates teacher reads relevant" ON billing_rates;
