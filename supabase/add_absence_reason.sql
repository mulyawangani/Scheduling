-- Absence sub-status: why a child is absent. The nanny picks Sick or Vacation
-- when marking someone absent. NULL = no reason recorded (older absences).
-- No policy changes needed: the column sits on attendance_records, whose existing
-- row level security already covers nanny, admin and owner.
-- Run in Supabase SQL editor. Safe to re-run.

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS absence_reason text
  CHECK (absence_reason IS NULL OR absence_reason IN ('sick', 'vacation'));
