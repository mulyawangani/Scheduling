-- Therapy Payments: tracks billing status per student per month for completed therapy sessions
-- Run in Supabase SQL editor (ywvabwboqazialrlwwbe)

CREATE TABLE IF NOT EXISTS therapy_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id           uuid REFERENCES schools(id) ON DELETE CASCADE,
  month               date NOT NULL,               -- 1st of the billing month
  session_count       int NOT NULL DEFAULT 0,      -- number of completed sessions this month
  rate_per_session    numeric(12, 2),              -- rate used at time of billing
  total_amount        numeric(12, 2),              -- session_count × rate_per_session
  currency            text NOT NULL DEFAULT 'IDR',
  status              text NOT NULL DEFAULT 'unpaid', -- unpaid | pending | paid | refunded
  xendit_invoice_id   text,
  xendit_payment_id   text,
  xendit_invoice_url  text,
  paid_at             timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, month)
);

ALTER TABLE therapy_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_therapy_payments" ON therapy_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);
CREATE POLICY "parent_read_own_therapy_payments" ON therapy_payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM students
    WHERE students.id = therapy_payments.student_id
      AND students.parent_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION update_therapy_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_therapy_payments_updated_at
  BEFORE UPDATE ON therapy_payments
  FOR EACH ROW EXECUTE FUNCTION update_therapy_payments_updated_at();
