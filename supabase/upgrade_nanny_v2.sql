-- Nanny persona v2 — richer check-in, behavior taxonomy, classroom photos
-- Run in Supabase SQL editor (ywvabwboqazialrlwwbe)

-- 1. Remove duplicate "Growth" classroom (keep the oldest row)
DELETE FROM classrooms
WHERE name = 'Growth'
  AND id != (
    SELECT id FROM classrooms WHERE name = 'Growth' ORDER BY created_at ASC LIMIT 1
  );

-- 2. Add physical_note to attendance_records
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS physical_note text;

-- 3. Extend behavior_logs with activity taxonomy fields
ALTER TABLE behavior_logs
  ADD COLUMN IF NOT EXISTS activity         text,
  ADD COLUMN IF NOT EXISTS sub_activity     text,
  ADD COLUMN IF NOT EXISTS other_teacher_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- 4. classroom_photos table
CREATE TABLE IF NOT EXISTS classroom_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  uploaded_by  uuid NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  photo_url    text NOT NULL,
  caption      text,
  status       text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE classroom_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nanny_manage_own_photos" ON classroom_photos;
DROP POLICY IF EXISTS "staff_manage_photos"     ON classroom_photos;
DROP POLICY IF EXISTS "all_read_published_photos" ON classroom_photos;

CREATE POLICY "nanny_manage_own_photos" ON classroom_photos FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'nanny')
  AND uploaded_by = auth.uid()
);
CREATE POLICY "staff_manage_photos" ON classroom_photos FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);
CREATE POLICY "all_read_published_photos" ON classroom_photos FOR SELECT USING (
  status = 'PUBLISHED'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
);

-- 5. Supabase Storage: create bucket "classroom-photos" (PUBLIC for photo URLs)
-- Run this manually in Supabase Storage UI or via:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('classroom-photos', 'classroom-photos', true);
-- DROP POLICY IF EXISTS "nanny_upload_photos" ON storage.objects;
-- CREATE POLICY "nanny_upload_photos" ON storage.objects FOR INSERT WITH CHECK (
--   bucket_id = 'classroom-photos'
--   AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('nanny', 'owner', 'admin'))
-- );
-- DROP POLICY IF EXISTS "all_read_photo_storage" ON storage.objects;
-- CREATE POLICY "all_read_photo_storage" ON storage.objects FOR SELECT USING (bucket_id = 'classroom-photos');
-- DROP POLICY IF EXISTS "owner_delete_photo_storage" ON storage.objects;
-- CREATE POLICY "owner_delete_photo_storage" ON storage.objects FOR DELETE USING (
--   bucket_id = 'classroom-photos'
--   AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('nanny', 'owner', 'admin'))
-- );
