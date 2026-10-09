-- Principal role, step 1 of 2.
-- Adds 'principal' to the role list. Run this on its own, then run
-- add_principal_role_2_access.sql in a NEW query: Postgres cannot use a new
-- enum value in the same transaction that adds it.
-- Safe to re-run.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'principal';
