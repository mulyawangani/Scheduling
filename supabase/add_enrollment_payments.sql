-- School (enrollment) payments: one row per student per month, with a status of unpaid, pending, paid,
-- failed or refunded. The Billing > School tab lists every student and, for each one enrolled that month,
-- creates the row (as unpaid) when the tab opens; an Owner or Admin then cycles its status.
--
-- This replaces the school-payments part of add_billing.sql, which also seeded made-up payment rows
-- (about 70% "paid"). This file creates the table only: no rows, no demo data.
--
-- Parents can read the payment status of their own child. Safe to re-run.

CREATE TABLE IF NOT EXISTS enrollment_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id           uuid REFERENCES schools(id) ON DELETE CASCADE,
  month               date NOT NULL,                  -- the 1st of the enrolled month
  amount              numeric(12, 2),
  currency            text NOT NULL DEFAULT 'IDR',
  status              text NOT NULL DEFAULT 'unpaid', -- unpaid | pending | paid | failed | refunded
  xendit_invoice_id   text,
  xendit_payment_id   text,
  xendit_invoice_url  text,
  paid_at             timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, month)
);

ALTER TABLE enrollment_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_payments" ON enrollment_payments;
CREATE POLICY "staff_manage_payments" ON enrollment_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "parent_read_own_payments" ON enrollment_payments;
CREATE POLICY "parent_read_own_payments" ON enrollment_payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM students
    WHERE students.id = enrollment_payments.student_id
      AND students.parent_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION update_enrollment_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enrollment_payments_updated_at ON enrollment_payments;
CREATE TRIGGER trg_enrollment_payments_updated_at
  BEFORE UPDATE ON enrollment_payments
  FOR EACH ROW EXECUTE FUNCTION update_enrollment_payments_updated_at();
