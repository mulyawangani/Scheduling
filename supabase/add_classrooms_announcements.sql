-- Classrooms (Montessori-style: primary + secondary + sub teacher, age group)
CREATE TABLE IF NOT EXISTS classrooms (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid REFERENCES schools(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  age_group             text,
  primary_teacher_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  secondary_teacher_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_admin_manage_classrooms" ON classrooms FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "teacher_read_classrooms" ON classrooms FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'owner', 'admin')
  )
);

-- Add classroom_id to students (optional FK — a student may be unassigned)
ALTER TABLE students ADD COLUMN IF NOT EXISTS classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL;

-- Announcements (DRAFT / SCHEDULED / PUBLISHED, targets ALL parents or a specific classroom)
CREATE TABLE IF NOT EXISTS announcements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid REFERENCES schools(id) ON DELETE CASCADE,
  author_id             uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title                 text NOT NULL,
  body                  text NOT NULL,
  target_type           text NOT NULL DEFAULT 'ALL',          -- 'ALL' or 'CLASSROOM'
  target_classroom_id   uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  status                text NOT NULL DEFAULT 'DRAFT',        -- 'DRAFT', 'SCHEDULED', 'PUBLISHED'
  scheduled_at          timestamptz,
  published_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_admin_manage_announcements" ON announcements FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "parent_read_published_announcements" ON announcements FOR SELECT USING (
  status = 'PUBLISHED' AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
  )
);
