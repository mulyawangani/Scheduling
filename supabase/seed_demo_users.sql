-- Demo users for the scheduling app (ywvabwboqazialrlwwbe)
-- Email convention: staff = @playtics, parents = @parent
-- Password for all: playtics2026
-- Run in Supabase SQL editor (service role required)

-- 1. Add nanny to the role enum (safe to re-run)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'nanny';

-- 2. Create all demo users (auth + profiles) in one block
DO $$
DECLARE
  v_owner_id   uuid := 'a0000000-0000-0000-0000-000000000001';
  v_admin_id   uuid := 'a0000000-0000-0000-0000-000000000002';
  v_teacher_id uuid := 'a0000000-0000-0000-0000-000000000003';
  v_nanny_id   uuid := 'a0000000-0000-0000-0000-000000000004';
  v_parent_id  uuid := 'a0000000-0000-0000-0000-000000000005';
BEGIN
  -- Auth users (skip any that already exist)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud)
  VALUES
    (v_owner_id,   '00000000-0000-0000-0000-000000000000', 'demo.owner@playtics',   crypt('playtics2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
    (v_admin_id,   '00000000-0000-0000-0000-000000000000', 'demo.admin@playtics',   crypt('playtics2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
    (v_teacher_id, '00000000-0000-0000-0000-000000000000', 'demo.teacher@playtics', crypt('playtics2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
    (v_nanny_id,   '00000000-0000-0000-0000-000000000000', 'demo.nanny@playtics',   crypt('playtics2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
    (v_parent_id,  '00000000-0000-0000-0000-000000000000', 'demo@parent',           crypt('playtics2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- Auth identities (needed for email login)
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_owner_id,   'demo.owner@playtics',   jsonb_build_object('sub', v_owner_id::text,   'email', 'demo.owner@playtics'),   'email', now(), now(), now()),
    (gen_random_uuid(), v_admin_id,   'demo.admin@playtics',   jsonb_build_object('sub', v_admin_id::text,   'email', 'demo.admin@playtics'),   'email', now(), now(), now()),
    (gen_random_uuid(), v_teacher_id, 'demo.teacher@playtics', jsonb_build_object('sub', v_teacher_id::text, 'email', 'demo.teacher@playtics'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_nanny_id,   'demo.nanny@playtics',   jsonb_build_object('sub', v_nanny_id::text,   'email', 'demo.nanny@playtics'),   'email', now(), now(), now()),
    (gen_random_uuid(), v_parent_id,  'demo@parent',           jsonb_build_object('sub', v_parent_id::text,  'email', 'demo@parent'),           'email', now(), now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  -- Profiles
  INSERT INTO profiles (id, role, name, email)
  VALUES
    (v_owner_id,   'owner',   'Demo Owner',   'demo.owner@playtics'),
    (v_admin_id,   'admin',   'Demo Admin',   'demo.admin@playtics'),
    (v_teacher_id, 'teacher', 'Demo Teacher', 'demo.teacher@playtics'),
    (v_nanny_id,   'nanny',   'Demo Nanny',   'demo.nanny@playtics'),
    (v_parent_id,  'parent',  'Demo Parent',  'demo@parent')
  ON CONFLICT (id) DO NOTHING;
END $$;
