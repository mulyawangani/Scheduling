-- Enrollment & Attendance
-- Run in Supabase SQL editor (ywvabwboqazialrlwwbe)

-- 1. Enrollments: one row per student per calendar month
CREATE TABLE IF NOT EXISTS enrollments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id   uuid REFERENCES schools(id) ON DELETE CASCADE,
  month       date NOT NULL,           -- always the 1st of the month
  status      text NOT NULL DEFAULT 'active',  -- active | cancelled
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, month)
);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_enrollments" ON enrollments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'nanny'))
);
CREATE POLICY "teacher_read_enrollments" ON enrollments FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);

-- 2. Attendance records: one row per student per calendar day
CREATE TABLE IF NOT EXISTS attendance_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id    uuid REFERENCES schools(id) ON DELETE CASCADE,
  date         date NOT NULL,
  status       text NOT NULL DEFAULT 'present',  -- present | absent | late | excused
  notes        text,
  recorded_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, date)
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_attendance" ON attendance_records FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'nanny'))
);
CREATE POLICY "teacher_read_attendance" ON attendance_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'owner', 'admin'))
);
CREATE POLICY "parent_read_own_child_attendance" ON attendance_records FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM students
    WHERE students.id = attendance_records.student_id
      AND students.parent_id = auth.uid()
  )
);

-- 3. Seed: enroll all non-inactive students for Oct 2026
--    Plus 60% for Nov, 30% for Dec (simulating prepaid months)
INSERT INTO enrollments (student_id, school_id, month, status)
SELECT
  s.id,
  s.school_id,
  '2026-10-01'::date,
  'active'
FROM students s
WHERE s.status != 'inactive'
ON CONFLICT (student_id, month) DO NOTHING;

-- Nov 2026 — roughly first 60% alphabetically
INSERT INTO enrollments (student_id, school_id, month, status)
SELECT
  s.id,
  s.school_id,
  '2026-11-01'::date,
  'active'
FROM (
  SELECT id, school_id, ROW_NUMBER() OVER (ORDER BY name) AS rn, COUNT(*) OVER () AS total
  FROM students WHERE status != 'inactive'
) s
WHERE s.rn <= ROUND(s.total * 0.6)
ON CONFLICT (student_id, month) DO NOTHING;

-- Dec 2026 — roughly first 30% alphabetically
INSERT INTO enrollments (student_id, school_id, month, status)
SELECT
  s.id,
  s.school_id,
  '2026-12-01'::date,
  'active'
FROM (
  SELECT id, school_id, ROW_NUMBER() OVER (ORDER BY name) AS rn, COUNT(*) OVER () AS total
  FROM students WHERE status != 'inactive'
) s
WHERE s.rn <= ROUND(s.total * 0.3)
ON CONFLICT (student_id, month) DO NOTHING;

-- 4. Seed: attendance for Oct 1–3, 2026 (weekdays only)
--    Present = 85% of enrolled students each day
INSERT INTO attendance_records (student_id, school_id, date, status)
SELECT
  e.student_id,
  e.school_id,
  d.day,
  CASE WHEN RANDOM() < 0.85 THEN 'present' ELSE 'absent' END
FROM enrollments e
CROSS JOIN (
  VALUES ('2026-10-01'::date), ('2026-10-02'::date), ('2026-10-03'::date)
) AS d(day)
WHERE e.month = '2026-10-01'
ON CONFLICT (student_id, date) DO NOTHING;
