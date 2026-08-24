-- Clean replacement of the old generic clients/schedule_offers model.
-- Pre-launch dev data only; safe to drop and recreate.
drop table if exists schedule_offers cascade;
drop table if exists clients cascade;

create extension if not exists pgcrypto;

create type user_role as enum ('parent', 'teacher', 'owner');
create type recurrence_type as enum ('one_off', 'weekly');
create type session_source as enum ('algorithm', 'manual');
-- 'completed': teacher-marked, only reachable from 'accepted', only meaningful
-- for one-off sessions (a weekly-recurring row has no single occurrence to
-- complete) — see teacher/actions.ts completeSession.
create type session_status as enum ('pending', 'accepted', 'declined', 'cancelled', 'completed');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  name text not null,
  phone text,
  email text,
  priority_tier smallint not null default 0,
  -- Owner-set caps, meaningful for teachers only. Independent of her
  -- uploaded availability by design — not derived from it.
  weekly_quota smallint check (weekly_quota is null or weekly_quota >= 0),
  daily_quota smallint check (daily_quota is null or daily_quota >= 0),
  -- Meaningful for the teacher role only: whether she's a regular teacher or
  -- a therapist.
  status text check (status is null or status in ('teacher', 'therapist')),
  -- Overrides which student status (see students.status) this provider can
  -- be matched to. Null = auto: 'teacher' status -> students only,
  -- 'therapist' status (or unset) -> non-students only. Set to 'both' to
  -- lift the restriction entirely, e.g. for a therapist who also covers
  -- students (Gaby).
  serves_scope text check (serves_scope is null or serves_scope in ('student_only', 'non_student_only', 'both')),
  created_at timestamptz not null default now()
);

-- Protocol is the top-level taxonomy — what a student needs, what a teacher
-- is qualified in, and what the matching algorithm matches on. Some
-- protocols break down further into Sub-Protocols (e.g. Reflex Repatterning
-- has ~24); most don't and are assigned/needed at the protocol level itself.
create table protocols (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  instructions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table sub_protocols (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references protocols(id) on delete cascade,
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (protocol_id, title)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  date_of_birth date,
  rate_per_session numeric(10,2),
  priority smallint check (priority is null or priority between 1 and 3),
  -- 'student': availability is fixed to school hours (Mon-Fri 08:00-12:00),
  -- set automatically whenever this status is saved. 'non_student': the
  -- parent builds a custom weekly timetable on their own student page.
  -- 'inactive': owner-set pause — excluded from Generate Schedule and every
  -- unmet-needs listing entirely, regardless of her protocol needs.
  status text check (status is null or status in ('student', 'non_student', 'inactive')),
  -- Caps how many DIFFERENT protocols Generate Schedule will book for this
  -- student in a single week (e.g. 3 means at most 3 distinct protocols get
  -- a session that week, even if more are unmet). Combined with the
  -- monthly-reopening of unmet needs, this is what spreads a student's
  -- protocols out across the weeks of a month instead of repeating the same
  -- one. Every student has a real value (no "uncapped" option).
  weekly_target_sessions smallint not null default 2 check (weekly_target_sessions in (1, 2, 3)),
  created_at timestamptz not null default now()
);

-- A student's needs. Most protocols have no sub-items, so a need is usually
-- just (student_id, protocol_id) with sub_protocol_id null; for a protocol
-- like Reflex Repatterning that does break down, a student can need several
-- distinct sub-protocols at once, so uniqueness is enforced with two partial
-- indexes rather than a single composite primary key (which can't treat
-- multiple nulls in sub_protocol_id as distinct the way we need here).
create table student_protocols (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  protocol_id uuid not null references protocols(id) on delete cascade,
  sub_protocol_id uuid references sub_protocols(id) on delete cascade
);
create unique index student_protocols_protocol_only_uidx on student_protocols(student_id, protocol_id)
  where sub_protocol_id is null;
create unique index student_protocols_sub_protocol_uidx on student_protocols(student_id, sub_protocol_id)
  where sub_protocol_id is not null;

create table student_availability (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  -- Exactly one of these is set. day_of_week: recurring every week (the
  -- original model). specific_date: a one-time window for that exact date
  -- only — additive on top of any recurring window for that same weekday,
  -- not a replacement. Useful since Generate Schedule runs weekly (usually
  -- Fridays, for the following week), so a parent can open up a window for
  -- one particular upcoming date without it recurring forever.
  day_of_week smallint check (day_of_week between 0 and 6),
  specific_date date,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  check ((day_of_week is not null) <> (specific_date is not null))
);

create table teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  week_start_date date not null,  -- Monday of the specific week this row applies to
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time)
);
create index on teacher_availability(teacher_id, week_start_date);

-- A teacher_protocols row is a qualification: either at the protocol level
-- (sub_protocol_id null — the common case, since most protocols have no
-- sub-items) or at a specific sub-protocol. Either way it carries its own
-- 1-5 rating — there is no separate capability-rating table. A teacher's
-- qualification for a protocol (for matching purposes) is her best rating
-- among all rows with that protocol_id. The teacher can see her assigned
-- protocols but never the rating.
create table teacher_protocols (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  protocol_id uuid not null references protocols(id) on delete cascade,
  sub_protocol_id uuid references sub_protocols(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  assigned_by uuid references profiles(id),
  assigned_at timestamptz not null default now()
);
create index on teacher_protocols(teacher_id);
create index on teacher_protocols(protocol_id);

-- A center-wide cap: at most max_concurrent sessions (across EVERY provider,
-- therapists included — unlike teacher_concurrency_rules below, which is
-- teacher-only) running at the same instant within [start_time, end_time),
-- every day. Multiple rules can cover different bands (e.g. a busier
-- morning window).
create table capacity_rules (
  id uuid primary key default gen_random_uuid(),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  max_concurrent smallint not null check (max_concurrent > 0),
  created_at timestamptz not null default now()
);

-- Same shape as capacity_rules, but scoped to status='teacher' providers only
-- (the "how many teachers can run sessions in the same room at once" cap —
-- therapists are exempt). Multiple bands let the cap differ by time of day,
-- e.g. a tighter cap during school hours than in the afternoon.
create table teacher_concurrency_rules (
  id uuid primary key default gen_random_uuid(),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  max_concurrent smallint not null check (max_concurrent > 0),
  created_at timestamptz not null default now()
);

-- A need the owner has manually flagged from the Recommendation tab to jump
-- the queue — rankNeeds() sorts these ahead of the normal priority/rate/
-- protocol-needs rule, so the next Generate Schedule run tries them first.
-- "Temporary" by nature rather than by a timer: a need drops out of here on
-- its own once it's booked (getUnmetNeeds stops returning it), or the owner
-- un-prioritizes it by hand.
create table prioritized_needs (
  student_id uuid not null references students(id) on delete cascade,
  protocol_id uuid not null references protocols(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, protocol_id)
);

-- A frozen snapshot of one Generate Schedule run's proposals/unscheduled for
-- a given week — lets the owner try a change, regenerate, and keep the
-- earlier attempt around to compare or fall back to, since the live preview
-- itself is never persisted (it's recomputed fresh from current data on
-- every page load). "existing" (already-booked sessions) isn't snapshotted
-- since it's real committed data, not part of the what-if scenario.
create table schedule_versions (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  label text not null,
  proposals jsonb not null,
  unscheduled jsonb not null,
  -- How many sessions were already scheduled at save time — just the count,
  -- not the sessions themselves (those are real committed data, not part of
  -- the what-if snapshot; see the comment below). Lets each saved version
  -- show a true point-in-time total instead of today's live count.
  scheduled_count integer not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on schedule_versions(week_start_date);

-- Unlike schedule_versions above (a JSON snapshot for side-by-side
-- comparison, never booked), a schedule_batch is real: "Create schedule"
-- books every proposal into session_plans tagged with this batch's id, with
-- notification deliberately skipped at booking time. The owner then reviews
-- the batch on the Schedules tab and fires "WhatsApp push" once for the
-- whole batch, whenever she's ready — whatsapp_pushed_at records when.
create table schedule_batches (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  label text not null,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  whatsapp_pushed_at timestamptz
);
create index on schedule_batches(week_start_date);

-- Owner-editable matching policy for Generate Schedule, kept as a single
-- always-present row (id is fixed to true) so the owner can retune it from
-- the Rules tab without a code change. rank_1/2/3 must be a permutation of
-- 'priority' | 'rate' | 'protocol_needs' — the order needs are attempted in
-- when slots are scarce; each factor's *_direction says which end wins ties
-- ('desc' = higher number / more sub-protocols goes first). Per-time-band
-- teacher concurrency caps live in teacher_concurrency_rules, not here.
create table scheduling_rules (
  id boolean primary key default true check (id),
  -- Ordered list of every ranking factor, each appearing exactly once —
  -- reorderable on the Rules tab. protocol_needs is a raw count of how many
  -- sub-protocols the need itself has, independent of whether anyone can
  -- actually deliver it; match_quality and teacher_rating are what reflect
  -- real matching capability (see rankNeeds in rank-needs.ts).
  rank_order text[] not null default array['priority', 'rate', 'protocol_needs', 'match_quality', 'teacher_rating'],
  priority_direction text not null default 'desc' check (priority_direction in ('asc', 'desc')),
  rate_direction text not null default 'desc' check (rate_direction in ('asc', 'desc')),
  protocol_needs_direction text not null default 'desc' check (protocol_needs_direction in ('asc', 'desc')),
  -- match_quality: 0-1, how much of this need's required sub-protocols the
  -- best available teacher actually covers. teacher_rating: that same best
  -- available teacher's rating (1-5) for this protocol/sub-protocol set.
  -- Both computed from teacher_protocols against the need's own required
  -- sub-protocols, independent of her availability/load this week.
  match_quality_direction text not null default 'desc' check (match_quality_direction in ('asc', 'desc')),
  teacher_rating_direction text not null default 'desc' check (teacher_rating_direction in ('asc', 'desc')),
  -- A teacher covering at least this % of a need's required sub-protocols
  -- counts as a full (1.0) match for ranking, same as a protocol with no
  -- sub-items (whose coverage is trivially 1.0 the moment anyone qualifies).
  -- Lower = more partial matches count as "good enough"; 100 = only exact
  -- full coverage counts, same as before this column existed.
  match_quality_threshold smallint not null default 50 check (match_quality_threshold between 0 and 100),
  -- A disabled factor is skipped entirely in the matching-order tiebreak
  -- cascade (rankNeeds in rank-needs.ts) — not just pushed last, which would
  -- still apply it when the factors above it tie. All true means every
  -- factor participates, same as before this column existed.
  priority_enabled boolean not null default true,
  rate_enabled boolean not null default true,
  protocol_needs_enabled boolean not null default true,
  match_quality_enabled boolean not null default true,
  teacher_rating_enabled boolean not null default true,
  -- Every status='student' student should end the week with at least this
  -- many sessions. Never invents a session for a protocol she doesn't need —
  -- it only reorders her existing unmet needs ahead of the normal Rules
  -- order (below explicit prioritized stars) while she's still under this
  -- floor. 0 disables it.
  weekly_minimum_sessions smallint not null default 1 check (weekly_minimum_sessions >= 0),
  -- Fairness cap among status='teacher' providers (not therapists) for a
  -- single Generate Schedule run: a candidate teacher is skipped for a slot
  -- if taking it would put her more than this many sessions ahead of that
  -- week's least-loaded teacher. A need with no candidate left under this
  -- cap goes unscheduled rather than breaking the balance.
  max_weekly_spread smallint not null default 2 check (max_weekly_spread >= 0),
  -- Standing monthly obligation: every student needs at least one session
  -- with this teacher each calendar month, satisfied by ANY of her sessions
  -- with them that month. null = disabled. There's no dedicated "Monthly
  -- Check-in" protocol — Generate Schedule instead tries one of the
  -- student's own real unmet needs with this teacher first (see
  -- isMonthlyCheckinCandidate in generate-schedule.ts), so the session
  -- delivers an actual protocol rather than a synthetic placeholder one.
  monthly_checkin_teacher_id uuid references profiles(id) on delete set null,
  -- Manual owner override: this teacher is tried FIRST for every unmet need
  -- she's qualified for (ahead of the normal load/rating order below, and
  -- ahead of the monthly check-in teacher too) — a temporary lever for
  -- catching up a teacher who's fallen behind on workload. null = disabled.
  prioritized_teacher_id uuid references profiles(id) on delete set null,
  -- Manual owner override for students whose weekly_target_sessions is more
  -- than 1: when a student has several different unmet protocols competing
  -- for those distinct-protocol slots, this protocol wins the tiebreak and
  -- gets tried before her other needs (see rankNeeds in rank-needs.ts).
  -- null = no protocol-level preference, falls through to the normal
  -- matching order.
  prioritized_protocol_id uuid references protocols(id) on delete set null,
  -- When true, Generate Schedule never gives a student two sessions with zero
  -- gap between them the same day, even across different teachers/protocols.
  -- Checked against both already-committed sessions and ones the current run
  -- has already proposed. Doesn't constrain Manual Addition (an explicit
  -- owner override). Independent of no_back_to_back_teacher_enabled below.
  no_back_to_back_enabled boolean not null default false,
  -- Same as no_back_to_back_enabled above, but for a teacher never getting
  -- two sessions with zero gap between them the same day, across different
  -- students/protocols. Independently toggleable from the student rule.
  no_back_to_back_teacher_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into scheduling_rules (id) values (true);
insert into teacher_concurrency_rules (start_time, end_time, max_concurrent) values ('08:00', '12:00', 3);

-- Dates the owner has flagged on the calendar. A 'school' holiday means
-- Playtics itself is closed, so 'student'-status children (whose availability
-- is auto-derived from being on campus during school hours) aren't available
-- that date even though their recurring Mon-Fri row still exists; a 'public'
-- holiday means the whole center is closed and nothing is bookable that day.
create table holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null,
  type text not null default 'school' check (type in ('school', 'public')),
  created_at timestamptz not null default now()
);

create table session_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  protocol_id uuid not null references protocols(id) on delete cascade,
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
  -- Set only for sessions booked via "Create schedule"; null for everything
  -- booked the normal way (Book/Book all/manual assign), which still notify
  -- immediately per session as before.
  schedule_batch_id uuid references schedule_batches(id) on delete set null,
  check (
    (recurrence_type = 'one_off' and start_time is not null and end_time is not null and day_of_week is null)
    or (recurrence_type = 'weekly' and day_of_week is not null and time_of_day_start is not null and time_of_day_end is not null and start_time is null)
  )
);
create index on session_plans(student_id);
create index on session_plans(teacher_id);
create index on session_plans(token);

-- A weekly-recurring session_plans row is a standing commitment with no
-- date of its own, so it has no natural place to record "did the Tuesday
-- 3pm session actually happen this week" — this table is that per-week
-- attendance record, self-declared by the teacher the same way she marks a
-- one-off session Complete. One-off sessions don't use this table; their
-- own status='completed' already is the per-occurrence record.
create table session_occurrences (
  id uuid primary key default gen_random_uuid(),
  session_plan_id uuid not null references session_plans(id) on delete cascade,
  week_start_date date not null,
  completed_at timestamptz not null default now(),
  unique (session_plan_id, week_start_date)
);
create index on session_occurrences(session_plan_id);

-- Owner-set billing (what the family is charged) and commission (what the
-- provider earns) per session, scoped per child — replaces a single flat
-- rate per student/teacher, since real pricing varies by which provider
-- delivers the session for a given child. teacher_id null is that child's
-- default rate, applied whenever the delivering teacher has no row of her
-- own; teacher_id set is a specific teacher's own rate for that child,
-- which wins over the default when both exist.
create table billing_rates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid references profiles(id) on delete cascade,
  billing_rate numeric(10, 2) not null check (billing_rate >= 0),
  commission_rate numeric(10, 2) not null check (commission_rate >= 0),
  created_at timestamptz not null default now()
);
-- At most one default rate per child, and at most one rate per (child, teacher) pair.
create unique index billing_rates_default_unique on billing_rates(student_id) where teacher_id is null;
create unique index billing_rates_teacher_unique on billing_rates(student_id, teacher_id) where teacher_id is not null;

-- === RLS ===

alter table profiles enable row level security;
alter table protocols enable row level security;
alter table sub_protocols enable row level security;
alter table students enable row level security;
alter table student_protocols enable row level security;
alter table student_availability enable row level security;
alter table teacher_availability enable row level security;
alter table teacher_protocols enable row level security;
alter table capacity_rules enable row level security;
alter table teacher_concurrency_rules enable row level security;
alter table schedule_versions enable row level security;
alter table schedule_batches enable row level security;
alter table scheduling_rules enable row level security;
alter table holidays enable row level security;
alter table prioritized_needs enable row level security;
alter table session_plans enable row level security;
alter table session_occurrences enable row level security;
alter table billing_rates enable row level security;

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

-- protocols / sub_protocols (the library) — readable by any authenticated
-- user (a parent picks a protocol as a need, a teacher reads her
-- assignments), writable by owner only.
create policy "protocols readable by authenticated" on protocols
  for select to authenticated using (true);
create policy "protocols owner writes" on protocols
  for all to authenticated using (has_role('owner')) with check (has_role('owner'));

create policy "sub_protocols readable by authenticated" on sub_protocols
  for select to authenticated using (true);
create policy "sub_protocols owner writes" on sub_protocols
  for all to authenticated using (has_role('owner')) with check (has_role('owner'));

-- students
create policy "students parent or owner" on students
  for all to authenticated
  using (parent_id = auth.uid() or has_role('owner'))
  with check (parent_id = auth.uid() or has_role('owner'));
create policy "students teacher reads assigned" on students
  for select to authenticated
  using (is_teacher_of_student(id));

-- student_protocols
create policy "student_protocols parent or owner" on student_protocols
  for all to authenticated
  using (exists (select 1 from students s where s.id = student_id and s.parent_id = auth.uid()) or has_role('owner'))
  with check (exists (select 1 from students s where s.id = student_id and s.parent_id = auth.uid()) or has_role('owner'));
create policy "student_protocols teacher reads assigned" on student_protocols
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

-- teacher_availability
create policy "teacher_availability teacher manages own" on teacher_availability
  for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "teacher_availability owner reads all" on teacher_availability
  for select to authenticated
  using (has_role('owner'));

-- capacity_rules — readable by any authenticated user (used at session-create
-- time), writable by owner only.
create policy "capacity_rules readable by authenticated" on capacity_rules
  for select to authenticated using (true);
create policy "capacity_rules owner writes" on capacity_rules
  for all to authenticated using (has_role('owner')) with check (has_role('owner'));

create policy "teacher_concurrency_rules readable by authenticated" on teacher_concurrency_rules
  for select to authenticated using (true);
create policy "teacher_concurrency_rules owner writes" on teacher_concurrency_rules
  for all to authenticated using (has_role('owner')) with check (has_role('owner'));

create policy "schedule_versions owner only" on schedule_versions
  for all to authenticated using (has_role('owner')) with check (has_role('owner'));

create policy "schedule_batches owner only" on schedule_batches
  for all to authenticated using (has_role('owner')) with check (has_role('owner'));

create policy "scheduling_rules owner only" on scheduling_rules
  for all to authenticated using (has_role('owner')) with check (has_role('owner'));

create policy "prioritized_needs owner only" on prioritized_needs
  for all to authenticated using (has_role('owner')) with check (has_role('owner'));

-- holidays — readable by any authenticated user (the matching algorithm and
-- teacher/parent views may want to explain a gap), writable by owner only.
create policy "holidays readable by authenticated" on holidays
  for select to authenticated using (true);
create policy "holidays owner writes" on holidays
  for all to authenticated using (has_role('owner')) with check (has_role('owner'));

-- teacher_protocols (assignments)
create policy "teacher_protocols teacher reads own" on teacher_protocols
  for select to authenticated
  using (teacher_id = auth.uid());
create policy "teacher_protocols owner full access" on teacher_protocols
  for all to authenticated
  using (has_role('owner')) with check (has_role('owner'));

-- session_plans
create policy "session_plans owner full access" on session_plans
  for all to authenticated
  using (has_role('owner')) with check (has_role('owner'));
create policy "session_plans teacher reads own" on session_plans
  for select to authenticated
  using (teacher_id = auth.uid());
-- Lets a teacher confirm (pending -> accepted) or complete (accepted ->
-- completed) her own sessions from /teacher. Which specific transition is
-- allowed is enforced in teacher/actions.ts, not here — this policy is
-- just the row-ownership/status-range backstop.
create policy "session_plans teacher updates own" on session_plans
  for update to authenticated
  using (teacher_id = auth.uid() and status in ('pending', 'accepted'))
  with check (teacher_id = auth.uid() and status in ('accepted', 'completed'));
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

-- session_occurrences
create policy "session_occurrences owner full access" on session_occurrences
  for all to authenticated
  using (has_role('owner')) with check (has_role('owner'));
create policy "session_occurrences teacher manages own" on session_occurrences
  for all to authenticated
  using (exists (select 1 from session_plans sp where sp.id = session_plan_id and sp.teacher_id = auth.uid()))
  with check (exists (select 1 from session_plans sp where sp.id = session_plan_id and sp.teacher_id = auth.uid()));

-- billing_rates: owner manages everything; a teacher can read only her own
-- rate rows plus each child's default row (teacher_id null), which is what
-- her own Commissions tab needs to compute her totals. Cannot write.
create policy "billing_rates owner full access" on billing_rates
  for all to authenticated
  using (has_role('owner')) with check (has_role('owner'));
create policy "billing_rates teacher reads relevant" on billing_rates
  for select to authenticated
  using (teacher_id = auth.uid() or teacher_id is null);

-- No anon policies: /offer/[token] reads and updates via a service-role
-- server client scoped by exact token match in application code.
