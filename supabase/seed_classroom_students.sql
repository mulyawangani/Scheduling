-- Seed 12 demo classroom students (status = 'student') and assign to classrooms
-- Run in Supabase SQL editor (ywvabwboqazialrlwwbe)
-- Safe to re-run — uses ON CONFLICT DO NOTHING for inserts, skips already-assigned students

DO $$
DECLARE
  v_school_id  uuid := '00000000-0000-0000-0000-000000000001';
  v_parent_id  uuid := 'a0000000-0000-0000-0000-000000000005';  -- demo@parent from seed_demo_users.sql
  v_classroom_count int;
BEGIN

  -- 1. Insert 12 demo students with status = 'student' (classroom-enrolled)
  INSERT INTO students (id, parent_id, school_id, name, date_of_birth, status)
  VALUES
    ('c1000000-0000-0000-0000-000000000001', v_parent_id, v_school_id, 'Aisha Pratama',    '2020-03-12', 'student'),
    ('c1000000-0000-0000-0000-000000000002', v_parent_id, v_school_id, 'Bimo Santoso',     '2020-07-05', 'student'),
    ('c1000000-0000-0000-0000-000000000003', v_parent_id, v_school_id, 'Citra Dewi',       '2019-11-20', 'student'),
    ('c1000000-0000-0000-0000-000000000004', v_parent_id, v_school_id, 'Dimas Wibowo',     '2021-01-08', 'student'),
    ('c1000000-0000-0000-0000-000000000005', v_parent_id, v_school_id, 'Erika Sanjaya',    '2020-09-15', 'student'),
    ('c1000000-0000-0000-0000-000000000006', v_parent_id, v_school_id, 'Fajar Nugroho',    '2019-06-30', 'student'),
    ('c1000000-0000-0000-0000-000000000007', v_parent_id, v_school_id, 'Gita Rahayu',      '2021-04-22', 'student'),
    ('c1000000-0000-0000-0000-000000000008', v_parent_id, v_school_id, 'Hendra Kurniawan', '2020-12-01', 'student'),
    ('c1000000-0000-0000-0000-000000000009', v_parent_id, v_school_id, 'Indah Lestari',    '2019-08-17', 'student'),
    ('c1000000-0000-0000-0000-000000000010', v_parent_id, v_school_id, 'Joko Widodo',      '2021-02-14', 'student'),
    ('c1000000-0000-0000-0000-000000000011', v_parent_id, v_school_id, 'Kirana Putri',     '2020-05-28', 'student'),
    ('c1000000-0000-0000-0000-000000000012', v_parent_id, v_school_id, 'Lukman Hakim',     '2019-10-09', 'student')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Assign all unassigned 'student'-status kids round-robin across active classrooms
  SELECT COUNT(*) INTO v_classroom_count FROM classrooms WHERE school_id = v_school_id AND active = true;

  IF v_classroom_count = 0 THEN
    RAISE NOTICE 'No active classrooms found — run seed_nanny.sql first';
    RETURN;
  END IF;

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
      OFFSET ((s.rn - 1) % v_classroom_count)
      LIMIT 1
    ) c
  ) sub
  WHERE students.id = sub.student_id;

  RAISE NOTICE 'Done. % classroom students seeded and assigned.', v_classroom_count;
END $$;

-- Verify
SELECT c.name AS classroom, COUNT(s.id) AS students
FROM classrooms c
LEFT JOIN students s ON s.classroom_id = c.id AND s.status = 'student'
WHERE c.active = true
GROUP BY c.name
ORDER BY c.name;
