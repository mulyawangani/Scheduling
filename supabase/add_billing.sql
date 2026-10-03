-- Billing / Payment tracking
-- Run in Supabase SQL editor (ywvabwboqazialrlwwbe)

CREATE TABLE IF NOT EXISTS enrollment_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id           uuid REFERENCES schools(id) ON DELETE CASCADE,
  month               date NOT NULL,               -- 1st of the enrolled month
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

CREATE POLICY "staff_manage_payments" ON enrollment_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);
CREATE POLICY "parent_read_own_payments" ON enrollment_payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM students
    WHERE students.id = enrollment_payments.student_id
      AND students.parent_id = auth.uid()
  )
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_enrollment_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enrollment_payments_updated_at
  BEFORE UPDATE ON enrollment_payments
  FOR EACH ROW EXECUTE FUNCTION update_enrollment_payments_updated_at();

-- Seed: create an unpaid payment record for every existing enrollment
INSERT INTO enrollment_payments (student_id, school_id, month, status)
SELECT DISTINCT e.student_id, e.school_id, e.month, 'unpaid'
FROM enrollments e
WHERE e.status = 'active'
ON CONFLICT (student_id, month) DO NOTHING;

-- Mark a random ~70% of Oct 2026 enrollments as paid (demo data)
UPDATE enrollment_payments
SET status = 'paid',
    paid_at = now() - (RANDOM() * INTERVAL '10 days'),
    xendit_payment_id = 'demo-' || LEFT(gen_random_uuid()::text, 8)
WHERE month = '2026-10-01'
  AND RANDOM() < 0.7;
