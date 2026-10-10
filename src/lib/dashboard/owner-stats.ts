import type { BillingRate } from '@/lib/supabase/types'
import { lookupBillingRate } from '@/lib/billing'
import { sessionDateInWeek, type BookedSessionRow } from '@/lib/matching/weekly-coverage'
import { dateStringInBusinessTz } from '@/lib/timezone'
import { addWeeks, getWeekStart } from '@/lib/week'

// ── Children ────────────────────────────────────────────────────────────────

export interface ChildRow {
  id: string
  status: string | null
  classroom_id: string | null
  school_id: string | null
}

export interface ChildSummary {
  /** Montessori school students: active = enrolled this month; inactive = set to Inactive (for example graduated). */
  students: { active: number; inactive: number; notEnrolled: number }
  /** Therapy clients: active = Non-student, not set to Inactive; inactive = set to Inactive. */
  therapyClients: { active: number; inactive: number }
  /** Children set to Inactive with no classroom, enrollment or therapy on record, so in neither group. */
  inactiveNeither: number
  trial: number
  noStatus: number
  total: number
}

/**
 * Splits the children into Montessori students and therapy clients, each active or inactive.
 *
 * A Student is active when enrolled for the month; a Student not enrolled this month is counted apart
 * (still a current student, shown in the classroom). A Non-student is an active therapy client, since
 * therapy has no monthly enrollment. Inactive is a status of its own (a graduated student must be set
 * to it) and does not say what the child was, so an Inactive child counts as an inactive student when
 * they had a classroom or any enrollment, and as an inactive therapy client when they have therapy
 * needs or sessions. Both can apply: an inactive student can be a therapy client. Trial children and
 * children with no status are counted on their own.
 */
export function summarizeChildren(
  children: ChildRow[],
  enrolledThisMonth: Set<string>,
  everEnrolled: Set<string>,
  hasTherapy: Set<string>
): ChildSummary {
  const out: ChildSummary = {
    students: { active: 0, inactive: 0, notEnrolled: 0 },
    therapyClients: { active: 0, inactive: 0 },
    inactiveNeither: 0,
    trial: 0,
    noStatus: 0,
    total: children.length,
  }
  for (const c of children) {
    if (c.status === 'student') {
      if (enrolledThisMonth.has(c.id)) out.students.active += 1
      else out.students.notEnrolled += 1
    } else if (c.status === 'non_student') {
      out.therapyClients.active += 1
    } else if (c.status === 'inactive') {
      const wasStudent = !!c.classroom_id || everEnrolled.has(c.id)
      const isTherapyClient = hasTherapy.has(c.id)
      if (wasStudent) out.students.inactive += 1
      if (isTherapyClient) out.therapyClients.inactive += 1
      if (!wasStudent && !isTherapyClient) out.inactiveNeither += 1
    } else if (c.status === 'trial') {
      out.trial += 1
    } else {
      out.noStatus += 1
    }
  }
  return out
}

// ── Staff ───────────────────────────────────────────────────────────────────

export interface StaffSummary {
  principals: number
  teachers: number
  senior: number
  junior: number
  intern: number
  /** Teachers whose level has not been set. */
  notSet: number
}

/** Principals by role; teachers by the level the Owner set on each. */
export function summarizeStaff(staff: { id: string; role: string }[], levelById: Map<string, string | null>): StaffSummary {
  const out: StaffSummary = { principals: 0, teachers: 0, senior: 0, junior: 0, intern: 0, notSet: 0 }
  for (const s of staff) {
    if (s.role === 'principal') {
      out.principals += 1
    } else if (s.role === 'teacher') {
      out.teachers += 1
      const level = levelById.get(s.id)
      if (level === 'senior') out.senior += 1
      else if (level === 'junior') out.junior += 1
      else if (level === 'intern') out.intern += 1
      else out.notSet += 1
    }
  }
  return out
}

// ── Billing ─────────────────────────────────────────────────────────────────

export interface BillableSession extends BookedSessionRow {
  id: string
  student_id: string
  teacher_id: string
  status: string
}

export interface TherapyBilling {
  /** What the sessions on the calendar this month bill at the rates set. */
  scheduled: number
  /** The same, for sessions already delivered. */
  actual: number
  sessions: number
  delivered: number
  /** Sessions left out of both amounts because no billing rate is set for that child. */
  unrated: number
}

const lastDayOf = (month: string) => {
  const [year, mon] = month.split('-').map(Number)
  return `${month}-${String(new Date(Date.UTC(year, mon, 0)).getUTCDate()).padStart(2, '0')}`
}

/** The Monday of every week that touches the month (YYYY-MM), including the one that started in the month before. */
export function weeksOverlappingMonth(month: string): string[] {
  const last = lastDayOf(month)
  const weeks: string[] = []
  for (let w = getWeekStart(new Date(`${month}-01T12:00:00Z`)); w <= last; w = addWeeks(w, 1)) weeks.push(w)
  return weeks
}

/**
 * Calls `visit` once for every session on the calendar on a date in the month (YYYY-MM), with the Monday
 * of the week it falls in: a one-off once, a weekly session once for each of its weeks in the month.
 */
function forEachOccurrence(sessions: BillableSession[], month: string, visit: (session: BillableSession, weekStart: string) => void) {
  const first = `${month}-01`
  const last = lastDayOf(month)
  const weeks = weeksOverlappingMonth(month)
  for (const s of sessions) {
    if (s.recurrence_type === 'weekly') {
      for (const w of weeks) {
        const date = sessionDateInWeek(s, w)
        if (date && date >= first && date <= last) visit(s, w)
      }
    } else if (s.start_time) {
      const date = dateStringInBusinessTz(new Date(s.start_time))
      const week = getWeekStart(new Date(s.start_time))
      if (date >= first && date <= last && sessionDateInWeek(s, week)) visit(s, week)
    }
  }
}

/**
 * Therapy billing for one calendar month (YYYY-MM): every session on the calendar on a date in that
 * month, at the billing rate for that child and teacher. A one-off is delivered once marked Complete;
 * a weekly session is delivered for each week that has an occurrence record (`deliveredWeekly` holds
 * "sessionId:weekStartDate"). Same definitions as the Scheduling > Billing tab, summed over the month.
 */
export function therapyBillingForMonth(
  sessions: BillableSession[],
  rates: BillingRate[],
  deliveredWeekly: Set<string>,
  month: string
): TherapyBilling {
  const out: TherapyBilling = { scheduled: 0, actual: 0, sessions: 0, delivered: 0, unrated: 0 }
  forEachOccurrence(sessions, month, (s, week) => {
    const delivered = s.recurrence_type === 'weekly' ? deliveredWeekly.has(`${s.id}:${week}`) : s.status === 'completed'
    out.sessions += 1
    if (delivered) out.delivered += 1
    const rate = lookupBillingRate(rates, s.student_id, s.teacher_id)
    if (!rate) {
      out.unrated += 1
      return
    }
    out.scheduled += rate.billingRate
    if (delivered) out.actual += rate.billingRate
  })
  return out
}

/** How many therapy sessions each child has on the calendar in the month (same sessions as the billing above). */
export function sessionsPerChildInMonth(sessions: BillableSession[], month: string): Map<string, number> {
  const perChild = new Map<string, number>()
  forEachOccurrence(sessions, month, (s) => perChild.set(s.student_id, (perChild.get(s.student_id) ?? 0) + 1))
  return perChild
}

// ── Per school ──────────────────────────────────────────────────────────────

export interface SchoolRow {
  name: string
  /** Montessori students enrolled this month. */
  enrolled: number
  /** Active therapy clients (Non-students). */
  therapyClients: number
  /** Therapy sessions on the calendar this month for the school's children. */
  therapySessions: number
}

/**
 * One row per school, plus a "No school" row when some child has none: enrolled students, therapy
 * clients, and therapy sessions this month. A school with no children still shows, with zeros.
 */
export function summarizeSchools(
  schools: { id: string; name: string }[],
  children: ChildRow[],
  enrolledThisMonth: Set<string>,
  sessionsPerChild: Map<string, number>
): SchoolRow[] {
  const rows = new Map<string, SchoolRow>(schools.map((s) => [s.id, { name: s.name, enrolled: 0, therapyClients: 0, therapySessions: 0 }]))
  const NONE = '__none__'
  for (const c of children) {
    const key = c.school_id && rows.has(c.school_id) ? c.school_id : NONE
    let row = rows.get(key)
    if (!row) {
      row = { name: 'No school', enrolled: 0, therapyClients: 0, therapySessions: 0 }
      rows.set(key, row)
    }
    if (c.status === 'student' && enrolledThisMonth.has(c.id)) row.enrolled += 1
    if (c.status === 'non_student') row.therapyClients += 1
    row.therapySessions += sessionsPerChild.get(c.id) ?? 0
  }
  return Array.from(rows.values())
}

/** Montessori students already enrolled for a later month, from that month's enrollment rows. */
export function countEnrolledStudents(rows: { student_id: string }[], studentIds: Set<string>): number {
  return new Set(rows.map((r) => r.student_id).filter((id) => studentIds.has(id))).size
}

export interface ExtracurricularExpected {
  amount: number
  signups: number
  /** Sign-ups for an activity that has no monthly price yet. */
  unpriced: number
}

/** What this month's extracurricular sign-ups of enrolled children add up to at the activity prices. */
export function extracurricularExpected(
  signups: { student_id: string; monthly_price: number | null }[],
  enrolledThisMonth: Set<string>
): ExtracurricularExpected {
  const out: ExtracurricularExpected = { amount: 0, signups: 0, unpriced: 0 }
  for (const s of signups) {
    if (!enrolledThisMonth.has(s.student_id)) continue
    out.signups += 1
    if (s.monthly_price === null) out.unpriced += 1
    else out.amount += Number(s.monthly_price)
  }
  return out
}
