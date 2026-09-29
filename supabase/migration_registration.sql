-- Migration: add parent registration fields to students and create student_contacts
-- Target: ywvabwboqazialrlwwbe.supabase.co (scheduling project)
-- Run this in the Supabase SQL editor

-- 0. Allow authenticated parents to insert their own profile row on signup
create policy "parent can insert own profile"
  on profiles for insert
  with check (auth.uid() = id and role = 'parent');

-- 1. Add new columns to students table for registration data
alter table students
  add column if not exists nickname text,
  add column if not exists gender text,
  add column if not exists nationality text,
  add column if not exists religion text,
  add column if not exists address text,
  add column if not exists phone_home text,
  add column if not exists previous_school text,
  add column if not exists photo_url text;

-- 2. Create student_contacts table for father/mother/emergency contacts
create table if not exists student_contacts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  type text not null check (type in ('father', 'mother', 'emergency')),
  full_name text not null,
  phone_mobile text,
  phone_home text,
  email text,
  date_of_birth date,
  employment text,
  relationship text,
  created_at timestamptz not null default now()
);

-- 3. Enable RLS on student_contacts
alter table student_contacts enable row level security;

-- 4. Owners and admins can read all contacts
create policy "staff can read student_contacts"
  on student_contacts for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin', 'teacher')
    )
  );

-- 5. Service role (used by admin client) can insert/update/delete contacts
-- (No additional policy needed — service role bypasses RLS)

-- 6. Parents can read contacts for their own children
create policy "parents can read own student_contacts"
  on student_contacts for select
  using (
    exists (
      select 1 from students
      where students.id = student_contacts.student_id
      and students.parent_id = auth.uid()
    )
  );

-- 7. Parents can insert students linked to their own account
create policy "parent can insert own students"
  on students for insert
  with check (auth.uid() = parent_id);

-- 8. Parents can insert contacts for their own students
create policy "parent can insert student_contacts"
  on student_contacts for insert
  with check (
    exists (
      select 1 from students
      where students.id = student_contacts.student_id
      and students.parent_id = auth.uid()
    )
  );
