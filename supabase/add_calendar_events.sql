-- Weekly calendar events: lesson plans and extracurricular activities
-- Run in Supabase SQL editor (ywvabwboqazialrlwwbe)

CREATE TABLE IF NOT EXISTS calendar_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL CHECK (type IN ('lesson_plan', 'extracurricular')),
  title        text NOT NULL,
  description  text,
  -- day_of_week: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri (matches session_plans convention)
  day_of_week  smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  start_time   time NOT NULL,
  end_time     time NOT NULL CHECK (end_time > start_time),
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  school_id    uuid REFERENCES schools(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
  color        text,   -- optional hex override
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_calendar_events" ON calendar_events FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);
CREATE POLICY "teacher_read_calendar_events" ON calendar_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'owner', 'admin'))
);
CREATE POLICY "parent_read_calendar_events" ON calendar_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
);

-- Sample weekly schedule (edit or delete these to match the actual timetable)
INSERT INTO calendar_events (type, title, day_of_week, start_time, end_time) VALUES
  ('lesson_plan',    'Morning Circle',    1, '08:00', '08:30'),
  ('lesson_plan',    'Morning Circle',    2, '08:00', '08:30'),
  ('lesson_plan',    'Morning Circle',    3, '08:00', '08:30'),
  ('lesson_plan',    'Morning Circle',    4, '08:00', '08:30'),
  ('lesson_plan',    'Morning Circle',    5, '08:00', '08:30'),
  ('lesson_plan',    'Montessori Work',   1, '08:30', '11:00'),
  ('lesson_plan',    'Montessori Work',   2, '08:30', '11:00'),
  ('lesson_plan',    'Montessori Work',   3, '08:30', '11:00'),
  ('lesson_plan',    'Montessori Work',   4, '08:30', '11:00'),
  ('lesson_plan',    'Montessori Work',   5, '08:30', '11:00'),
  ('extracurricular','Art & Craft',       1, '14:00', '15:00'),
  ('extracurricular','Music',             3, '14:00', '15:00'),
  ('extracurricular','Sport & Games',     5, '13:00', '14:00');
