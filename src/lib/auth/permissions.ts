import type { UserRole } from '@/lib/supabase/types'

/**
 * Who may do what on the admin side. One table for the three staff roles
 * (owner, admin, principal). The menu, the page guards and the server actions
 * all read it, so a rule changes in exactly one place.
 *
 * Source: the permission matrix reviewed with the owner (row ids A1 to F4 are
 * the matrix rows). Owner = Admin + Principal + the owner-only rows.
 *
 *   yes  = may use it and change things
 *   view = read only
 *   no   = not at all
 *
 * `target` records what the matrix asks for where the app cannot do it yet
 * (or where the August design deliberately kept Admin narrower), so the gap
 * stays visible. Check the table with: node scripts/check-permissions.mjs
 */
export type Access = 'yes' | 'view' | 'no'
export type StaffRole = 'owner' | 'admin' | 'principal'

type Entry = {
  /** Row id in the permission matrix. */
  id: string
  label: string
  owner: Access
  admin: Access
  principal: Access
  /** What the matrix wants where the enforced value is lower. */
  target?: Partial<Record<StaffRole, Access>>
  /** Why the enforced value is what it is. */
  note?: string
  /** False when no screen exists yet. */
  built?: boolean
}

export const CAPS = {
  // ── A. People and roles ──────────────────────────────────────────────────
  'people.staff.view':        { id: 'A1',  label: 'See all staff profiles', owner: 'yes', admin: 'yes', principal: 'yes' },
  'people.protocols.view':    { id: 'A2',  label: "See a teacher's protocols and ratings", owner: 'yes', admin: 'yes', principal: 'no' },
  'people.protocols.edit':    { id: 'A3',  label: "Set a teacher's certified protocols and ratings", owner: 'yes', admin: 'view', principal: 'no',
                                note: 'Admin is view-only until the owner decides who rates a teacher.' },
  'people.teacher.add':       { id: 'A4',  label: 'Add a teacher account', owner: 'yes', admin: 'yes', principal: 'no' },
  'people.account.add':       { id: 'A5',  label: 'Add a principal, admin or nanny account', owner: 'yes', admin: 'yes', principal: 'no', built: false },
  'people.teacher.remove':    { id: 'A6',  label: 'Remove a staff account', owner: 'yes', admin: 'yes', principal: 'no' },
  'people.role.assign':       { id: 'A7',  label: 'Assign or change a role', owner: 'yes', admin: 'yes', principal: 'no', built: false,
                                note: 'Admin assigns every role except Owner.' },
  'people.password.reset':    { id: 'A8',  label: "Reset someone's password", owner: 'yes', admin: 'yes', principal: 'no', built: false,
                                note: 'Admin: non-owner accounts only.' },
  'people.teacher.edit':      { id: 'A9',  label: "Edit a teacher's name, status and scope", owner: 'yes', admin: 'view', principal: 'no',
                                note: 'The database only lets the Owner change other profiles.' },
  'people.teacher.quota':     { id: 'A10', label: "Set a teacher's weekly and daily quota", owner: 'yes', admin: 'no', principal: 'no', target: { admin: 'view' } },
  'people.teacher.noteReview': { id: 'A11', label: 'Switch a teacher between notes needing review and auto-publish', owner: 'yes', admin: 'no', principal: 'no' },
  'people.parent.edit':       { id: 'A12', label: "Edit a parent's name, phone and priority tier", owner: 'yes', admin: 'view', principal: 'view',
                                note: 'Not in the first matrix. The database only lets the Owner change another person\'s profile or a parent\'s priority tier; before this, Admin\'s Save on the Parents page did nothing.' },

  // ── B. Students and parents ──────────────────────────────────────────────
  'students.view':            { id: 'B1',  label: 'See all children and their parents', owner: 'yes', admin: 'yes', principal: 'yes' },
  'students.add':             { id: 'B2',  label: 'Add a child directly', owner: 'yes', admin: 'yes', principal: 'no' },
  'students.edit':            { id: 'B3',  label: "Edit a child's profile", owner: 'yes', admin: 'yes', principal: 'view', target: { principal: 'yes' },
                                note: 'Principal editing needs a database rule.' },
  'students.status':          { id: 'B4',  label: "Change a child's status", owner: 'yes', admin: 'yes', principal: 'view' },
  'students.billing':         { id: 'B5',  label: 'Set billing rate, therapy priority and weekly session target', owner: 'yes', admin: 'yes', principal: 'no' },
  'students.needs':           { id: 'B6',  label: 'Choose which therapies a child needs', owner: 'yes', admin: 'no', principal: 'view',
                                note: 'The owner asked on Oct 5 to take the protocol list out of the Admin view; the matrix draft suggested view-only.' },
  'students.classroom':       { id: 'B7',  label: 'Move a child to a classroom', owner: 'yes', admin: 'yes', principal: 'view', target: { principal: 'yes' },
                                note: 'Principal editing needs a database rule.' },
  'students.delete':          { id: 'B8',  label: 'Delete a child permanently', owner: 'yes', admin: 'no', principal: 'no' },
  'students.contacts.view':   { id: 'B9',  label: "See the parents' contacts", owner: 'yes', admin: 'yes', principal: 'yes' },
  'students.contacts.edit':   { id: 'B10', label: "Edit a child's contacts", owner: 'yes', admin: 'yes', principal: 'view', built: false, target: { principal: 'yes' } },
  'students.enrollmentRequests': { id: 'B11', label: 'Confirm or reject an enrollment request', owner: 'yes', admin: 'yes', principal: 'view', built: false },
  'students.enrollment':      { id: 'B12', label: 'Enroll or unenroll a child for a month', owner: 'yes', admin: 'yes', principal: 'view' },

  // ── C. Daily school operations ───────────────────────────────────────────
  'ops.attendance.record':    { id: 'C1',  label: 'Record attendance', owner: 'yes', admin: 'yes', principal: 'view' },
  'ops.attendance.view':      { id: 'C2',  label: 'See attendance and temperatures', owner: 'yes', admin: 'yes', principal: 'yes' },
  'ops.classrooms':           { id: 'C3',  label: 'Create, rename and delete classrooms', owner: 'yes', admin: 'yes', principal: 'yes' },
  'ops.classrooms.teachers':  { id: 'C4',  label: 'Assign teachers to a classroom', owner: 'yes', admin: 'yes', principal: 'yes',
                                note: 'Undecided: the Library assigns teachers per lesson-plan day instead.' },
  'ops.timetable':            { id: 'C5',  label: 'Edit the classroom weekly timetable', owner: 'yes', admin: 'yes', principal: 'yes', built: false },
  'ops.photos':               { id: 'C6',  label: 'Upload and publish classroom photos', owner: 'yes', admin: 'yes', principal: 'no', target: { principal: 'view' },
                                note: 'Photos live on the Nanny pages, which only Nanny, Owner and Admin can open.' },
  'ops.announcements':        { id: 'C7',  label: 'Create and publish announcements', owner: 'yes', admin: 'yes', principal: 'no' },
  'ops.extracurricular':      { id: 'C8',  label: 'Manage extracurricular activities and prices', owner: 'yes', admin: 'yes', principal: 'no' },
  'ops.billing':              { id: 'C9',  label: 'See payments and change a payment status', owner: 'yes', admin: 'yes', principal: 'no' },

  // ── D. Scheduling and therapy ────────────────────────────────────────────
  'sched.calendar':           { id: 'D1',  label: 'See all sessions in the weekly calendar', owner: 'yes', admin: 'yes', principal: 'yes' },
  'sched.teacherView':        { id: 'D2',  label: "See one teacher's schedule", owner: 'yes', admin: 'yes', principal: 'yes',
                                note: 'Lives on the teacher page (Teachers, click a name). The matrix draft wrongly said it was not built.' },
  'sched.generate':           { id: 'D3',  label: 'Generate a schedule and book it', owner: 'yes', admin: 'no', principal: 'no', target: { admin: 'yes' },
                                note: 'August design kept Admin out of this; the persona notes allow it. Owner to decide.' },
  'sched.manual':             { id: 'D4',  label: 'Add a session by hand', owner: 'yes', admin: 'no', principal: 'no', target: { admin: 'yes' },
                                note: 'Same open question as generating a schedule.' },
  'sched.reschedule':         { id: 'D4b', label: 'Reschedule a cancelled or declined need', owner: 'yes', admin: 'yes', principal: 'no' },
  'sched.versions':           { id: 'D5',  label: 'Review and publish schedule versions', owner: 'yes', admin: 'no', principal: 'no', target: { admin: 'yes' } },
  'sched.schedules':          { id: 'D5b', label: 'Send confirmed sessions to parents', owner: 'yes', admin: 'yes', principal: 'no' },
  'sched.rules':              { id: 'D6',  label: 'Set capacity, concurrency and scheduling rules', owner: 'yes', admin: 'no', principal: 'no', target: { admin: 'yes' } },
  'sched.rates':              { id: 'D7',  label: 'Manage billing rates', owner: 'yes', admin: 'yes', principal: 'no' },
  'sched.needs':              { id: 'D8',  label: 'Manage prioritized needs and recommendations', owner: 'yes', admin: 'no', principal: 'no', target: { admin: 'yes' } },
  'sched.reports':            { id: 'D8b', label: 'See scheduling reports', owner: 'yes', admin: 'yes', principal: 'no' },
  'sched.protocolsLibrary':   { id: 'D9',  label: 'Create, rename and retire protocols', owner: 'yes', admin: 'no', principal: 'no', target: { admin: 'view' } },
  'notes.review':             { id: 'D10', label: 'Review therapy notes (accept or send back)', owner: 'yes', admin: 'no', principal: 'no',
                                note: 'Owner only (decided 10 Oct 2026). A teacher reads only the notes they wrote; see fix_therapy_notes_access.sql.' },
  'audit.view':               { id: 'D11', label: 'See the full audit log', owner: 'yes', admin: 'no', principal: 'no', target: { admin: 'yes' } },
  'sched.reset':              { id: 'D12', label: 'Cancel or reset the whole schedule', owner: 'yes', admin: 'no', principal: 'no' },

  // ── E. School settings ───────────────────────────────────────────────────
  'settings.school':          { id: 'E1',  label: 'School profile; create and delete schools', owner: 'yes', admin: 'no', principal: 'no', target: { admin: 'yes' } },
  'settings.locations':       { id: 'E2',  label: 'Therapy locations', owner: 'yes', admin: 'yes', principal: 'no', built: false },
  'settings.holidays':        { id: 'E3',  label: 'School holidays', owner: 'yes', admin: 'no', principal: 'no', target: { admin: 'yes' } },
  'settings.academicYears':   { id: 'E4',  label: 'Academic years', owner: 'yes', admin: 'yes', principal: 'no', built: false },
} as const satisfies Record<string, Entry>

export type Capability = keyof typeof CAPS

export const STAFF_ROLES: readonly StaffRole[] = ['owner', 'admin', 'principal']

export function isStaffRole(role: UserRole | string | null | undefined): role is StaffRole {
  return role === 'owner' || role === 'admin' || role === 'principal'
}

/** The access a role has to a capability. Roles outside the admin side get 'no'. */
export function accessOf(role: UserRole | string | null | undefined, cap: Capability): Access {
  return isStaffRole(role) ? CAPS[cap][role] : 'no'
}

/** May the role see / use it at all (yes or view)? */
export function can(role: UserRole | string | null | undefined, cap: Capability): boolean {
  return accessOf(role, cap) !== 'no'
}

/** May the role change things (yes only)? */
export function canChange(role: UserRole | string | null | undefined, cap: Capability): boolean {
  return accessOf(role, cap) === 'yes'
}

/** May the role use at least one of the capabilities? */
export function canAny(role: UserRole | string | null | undefined, caps: readonly Capability[]): boolean {
  return caps.some((c) => can(role, c))
}
