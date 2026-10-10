-- Therapy notes: who may read them. Decided 10 Oct 2026.
--
--   Owner      reads every note and is the only one who reviews (accept or send back).
--   Teacher    reads only the notes they wrote.
--   Parent     reads only accepted notes of their own children (unchanged).
--   Principal  and Admin read none.
--
-- 1. Principal: remove the read and review rules that add_principal_role_2_access.sql
--    used to create.
-- 2. Teachers: remove "therapy_notes teacher reads for shared students" (schema.sql),
--    which let a teacher read the sent notes of other teachers for a child they both
--    teach. Teachers keep "therapy_notes teacher manages own" (their own notes only).
--    The Write note page now carries forward from the teacher's own earlier notes only.
--
-- Safe to re-run.

DROP POLICY IF EXISTS "therapy_notes principal reads submitted" ON therapy_notes;
DROP POLICY IF EXISTS "therapy_notes principal reviews" ON therapy_notes;
DROP POLICY IF EXISTS "therapy_notes teacher reads for shared students" ON therapy_notes;
