-- Nanny demo user + classrooms setup
-- Run in Supabase SQL editor (ywvabwboqazialrlwwbe)
-- Creates: nanny@playtics / nanny123 + 3 classrooms + student assignments

DO $$
DECLARE
  v_nanny_id  uuid := 'b0000000-0000-0000-0000-000000000001';
  v_school_id uuid;
BEGIN
  -- Pick the first school
  SELECT id INTO v_school_id FROM schools LIMIT 1;

  -- 1. Auth user
  INSERT INTO auth.users (id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud)
  VALUES (
    v_nanny_id,
    '00000000-0000-0000-0000-000000000000',
    'nanny@playtics',
    crypt('nanny123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}', false, 'authenticated', 'authenticated'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Auth identity (needed for email sign-in)
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_nanny_id,
    'nanny@playtics',
    jsonb_build_object('sub', v_nanny_id::text, 'email', 'nanny@playtics'),
    'email', now(), now(), now()
  )
  ON CONFLICT (provider, provider_id) DO NOTHING;

  -- 3. Profile
  INSERT INTO profiles (id, role, name, email)
  VALUES (v_nanny_id, 'nanny', 'Demo Nanny', 'nanny@playtics')
  ON CONFLICT (id) DO NOTHING;

  -- 4. Classrooms (skip if already exist for this school)
  IF NOT EXISTS (SELECT 1 FROM classrooms WHERE school_id = v_school_id AND active = true) THEN
    INSERT INTO classrooms (school_id, name, active)
    VALUES
      (v_school_id, 'Confidence',           true),
      (v_school_id, 'Confidence extension', true),
      (v_school_id, 'Growth',               true),
      (v_school_id, 'Growth extension',     true),
      (v_school_id, 'Integrity',            true),
      (v_school_id, 'Kindness',             true),
      (v_school_id, 'Resilience',           true),
      (v_school_id, 'Resilience extension', true);
  END IF;

  -- 5. Assign students evenly across classrooms (only unassigned students)
  UPDATE students
  SET classroom_id = sub.classroom_id
  FROM (
    SELECT
      s.id AS student_id,
      c.id AS classroom_id
    FROM (
      SELECT id, row_number() OVER (ORDER BY name) AS rn
      FROM students
      WHERE school_id = v_school_id
        AND status = 'student'
        AND classroom_id IS NULL
    ) s
    CROSS JOIN LATERAL (
      SELECT id FROM classrooms
      WHERE school_id = v_school_id AND active = true
      ORDER BY name
      OFFSET ((s.rn - 1) % (SELECT COUNT(*) FROM classrooms WHERE school_id = v_school_id AND active = true))
      LIMIT 1
    ) c
  ) sub
  WHERE students.id = sub.student_id;

END $$;

-- 6. Allow nanny to read classrooms (extend existing read policy)
DROP POLICY IF EXISTS "teacher_read_classrooms" ON classrooms;
CREATE POLICY "staff_read_classrooms" ON classrooms FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('teacher', 'owner', 'admin', 'nanny')
  )
);
