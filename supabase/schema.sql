-- Clean replacement of the old generic clients/schedule_offers model.
-- Pre-launch dev data only; safe to drop and recreate.
drop table if exists schedule_offers cascade;
drop table if exists clients cascade;

create extension if not exists pgcrypto;

create type user_role as enum ('parent', 'teacher', 'owner');
create type recurrence_type as enum ('one_off', 'weekly');
create type session_source as enum ('algorithm', 'manual');
create type session_status as enum ('pending', 'accepted', 'declined', 'cancelled');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  name text not null,
  phone text,
  email text,
  priority_tier smallint not null default 0,
  created_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table student_subjects (
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  primary key (student_id, subject_id)
);

create table student_availability (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time)
);

create table teacher_capabilities (
  teacher_id uuid not null references profiles(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  rated_by uuid references profiles(id),
  rated_at timestamptz not null default now(),
  primary key (teacher_id, subject_id)
);

create table teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time)
);

create table session_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  recurrence_type recurrence_type not null,
  start_time timestamptz,
  end_time timestamptz,
  day_of_week smallint check (day_of_week between 0 and 6),
  time_of_day_start time,
  time_of_day_end time,
  source session_source not null default 'manual',
  status session_status not null default 'pending',
  note text,
  match_score smallint check (match_score between 0 and 100),
  token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (
    (recurrence_type = 'one_off' and start_time is not null and end_time is not null and day_of_week is null)
    or (recurrence_type = 'weekly' and day_of_week is not null and time_of_day_start is not null and time_of_day_end is not null and start_time is null)
  )
);
create index on session_plans(student_id);
create index on session_plans(teacher_id);
create index on session_plans(token);

-- === RLS ===

alter table profiles enable row level security;
alter table subjects enable row level security;
alter table students enable row level security;
alter table student_subjects enable row level security;
alter table student_availability enable row level security;
alter table teacher_capabilities enable row level security;
alter table teacher_availability enable row level security;
alter table session_plans enable row level security;

create or replace function has_role(check_role user_role) returns boolean
language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = check_role);
$$;

-- A teacher may see a student only if they have a session_plans row for them.
create or replace function is_teacher_of_student(p_student_id uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from session_plans
    where student_id = p_student_id and teacher_id = auth.uid()
  );
$$;

-- profiles
create policy "select own or owner sees all" on profiles
  for select to authenticated
  using (id = auth.uid() or has_role('owner'));

create policy "self insert as parent" on profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'parent');

-- A parent needs to see the *name* of the teacher assigned to their child's
-- session (e.g. on /parent/students/[id]) even though they aren't the
-- teacher or an owner — narrowly scoped to teachers actually assigned to one
-- of their own students, not all teacher profiles.
create policy "parent reads assigned teacher profile" on profiles
  for select to authenticated
  using (
    exists (
      select 1 from session_plans sp
      join students s on s.id = sp.student_id
      where sp.teacher_id = profiles.id and s.parent_id = auth.uid()
    )
  );

create policy "owner inserts any role" on profiles
  for insert to authenticated
  with check (has_role('owner'));

create policy "update own row or owner updates any" on profiles
  for update to authenticated
  using (id = auth.uid() or has_role('owner'))
  with check (id = auth.uid() or has_role('owner'));

-- A plain USING/WITH CHECK pair can't compare old vs. new column values, so a
-- self-service parent update could otherwise smuggle in a role/priority_tier
-- change. A trigger closes that gap regardless of which policy let the
-- UPDATE through.
create or replace function prevent_role_self_escalation() returns trigger
language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.priority_tier is distinct from old.priority_tier)
     and not has_role('owner') then
    raise exception 'only an owner can change role or priority_tier';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_escalation
  before update on profiles
  for each row execute function prevent_role_self_escalation();

-- subjects
create policy "subjects readable by authenticated" on subjects
  for select to authenticated using (true);
create policy "subjects owner writes" on subjects
  for all to authenticated using (has_role('owner')) with check (has_role('owner'));

-- students
create policy "students parent or owner" on students
  for all to authenticated
  using (parent_id = auth.uid() or has_role('owner'))
  with check (parent_id = auth.uid() or has_role('owner'));
create policy "students teacher reads assigned" on students
  for select to authenticated
  using (is_teacher_of_student(id));

-- student_subjects
create policy "student_subjects parent or owner" on student_subjects
  for all to authenticated
  using (exists (select 1 from students s where s.id = student_id and s.parent_id = auth.uid()) or has_role('owner'))
  with check (exists (select 1 from students s where s.id = student_id and s.parent_id = auth.uid()) or has_role('owner'));
create policy "student_subjects teacher reads assigned" on student_subjects
  for select to authenticated
  using (is_teacher_of_student(student_id));

-- student_availability
create policy "student_availability parent or owner" on student_availability
  for all to authenticated
  using (exists (select 1 from students s where s.id = student_id and s.parent_id = auth.uid()) or has_role('owner'))
  with check (exists (select 1 from students s where s.id = student_id and s.parent_id = auth.uid()) or has_role('owner'));
create policy "student_availability teacher reads assigned" on student_availability
  for select to authenticated
  using (is_teacher_of_student(student_id));

-- teacher_capabilities
create policy "teacher_capabilities teacher reads own" on teacher_capabilities
  for select to authenticated
  using (teacher_id = auth.uid());
create policy "teacher_capabilities owner full access" on teacher_capabilities
  for all to authenticated
  using (has_role('owner')) with check (has_role('owner'));

-- teacher_availability
create policy "teacher_availability teacher manages own" on teacher_availability
  for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "teacher_availability owner reads all" on teacher_availability
  for select to authenticated
  using (has_role('owner'));

-- session_plans
create policy "session_plans owner full access" on session_plans
  for all to authenticated
  using (has_role('owner')) with check (has_role('owner'));
create policy "session_plans teacher reads own" on session_plans
  for select to authenticated
  using (teacher_id = auth.uid());
create policy "session_plans parent reads own students" on session_plans
  for select to authenticated
  using (exists (select 1 from students s where s.id = student_id and s.parent_id = auth.uid()));
create policy "session_plans parent cancels own" on session_plans
  for update to authenticated
  using (
    status in ('pending', 'accepted')
    and exists (select 1 from students s where s.id = student_id and s.parent_id = auth.uid())
  )
  with check (status = 'cancelled');

-- No anon policies: /offer/[token] reads and updates via a service-role
-- server client scoped by exact token match in application code.
