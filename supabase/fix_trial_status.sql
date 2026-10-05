-- Fix students registered via signup form on 2026-10-04 that got status=null
-- The register page was setting status: null instead of status: 'trial'
-- This is now fixed in code; this SQL patches the existing rows.

UPDATE students
SET status = 'trial'
WHERE status IS NULL;

-- Verify
SELECT name, status, created_at
FROM students
WHERE status = 'trial'
ORDER BY created_at DESC;
