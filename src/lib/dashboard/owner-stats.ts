import type { BillingRate } from '@/lib/supabase/types'
import { lookupBillingRate } from '@/lib/billing'
import { sessionDateInWeek, type BookedSessionRow } from '@/lib/matching/weekly-coverage'
import { businessLocalToISOString, dateStringInBusinessTz } from '@/lib/timezone'
import { addWeeks, getWeekStart } from '@/lib/week'

// ── Children ────────────────────────────────────────────────────────────────

export interface ChildRow {
  id: string
  status: string | null
  /** Therapy switch, separate from the status. */
  therapy_on: boolean
  classroom_id: string | null
  school_id: string | null
}

export interface ChildSummary {
  /**
   * Montessori school students: active = enrolled this month; inactive = not enrolled this month, or set
   * to Inactive after being a student (for example graduated). `notEnrolled` is the part of `inactive`
   * that is still a Student.
   */
  students: { active: number; inactive: number; notEnrolled: number }
  /** Therapy clients: active = therapy switched on; inactive = switched off after sessions were booked. */
  therapyClients: { active: number; inactive: number }
  /** Children set to Inactive who never had a classroom or an enrollment (not a Montessori student). */
  inactiveNotStudent: number
  /** School status counts that are not Montessori students. */
  trial: number
  nonStudents: number
  noStatus: number
  total: number
}

/**
 * Every child has two separate settings: a school status (None, Trial, Non-student, Student, Inactive)
 * and a therapy switch (on or off). Any combination is possible, for example Trial and on therapy, or
 * Inactive and on therapy.
 *
 * Montessori students follow the status: a Student is active when enrolled for the month and inactive
 * when not enrolled this month; a child set to Inactive (a graduated student must be) counts as an
 * inactive student when they ever had a classroom or an enrollment, otherwise they are noted apart.
 * Therapy clients follow the switch alone, whatever the status: on is active; off is inactive when
 * sessions were booked for the child before (`hadTherapy`), and otherwise the child was never a client.
 */
export function summarizeChildren(
  children: ChildRow[],
  enrolledThisMonth: Set<string>,
  everEnrolled: Set<string>,
  hadTherapy: Set<string>
): ChildSummary {
  const out: ChildSummary = {
    students: { active: 0, inactive: 0, notEnrolled: 0 },
    therapyClients: { active: 0, inactive: 0 },
    inactiveNotStudent: 0,
    trial: 0,
    nonStudents: 0,
    noStatus: 0,
    total: children.length,
  }
  for (const c of children) {
    if (c.status === 'student') {
      if (enrolledThisMonth.has(c.id)) {
        out.students.active += 1
      } else {
        out.students.inactive += 1
        out.students.notEnrolled += 1
      }
    } else if (c.status === 'inactive') {
      if (c.classroom_id || everEnrolled.has(c.id)) out.students.inactive += 1
      else out.inactiveNotStudent += 1
    } else if (c.status === 'trial') {
      out.trial += 1
    } else if (c.status === 'non_student') {
      out.nonStudents += 1
    } else {
      out.noStatus += 1
    }

    if (c.therapy_on) out.therapyClients.active += 1
    else if (hadTherapy.has(c.id)) out.therapyClients.inactive += 1
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
  /** Teacher commission on the sessions on the calendar, and on those already delivered, at the commission rates set. */
  scheduledCommission: number
  actualCommission: number
  /**
   * Therapy income: what is billed minus the teacher commission, on the sessions already delivered
   * (`income`) and on all those on the calendar (`scheduledIncome`).
   */
  income: number
  scheduledIncome: number
  sessions: number
  delivered: number
  /** Sessions left out of every amount because no billing rate is set for that child. */
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
 * month, at the billing rate for that child and teacher, less the teacher's commission for the
 * therapy income. A one-off is delivered once marked Complete;
 * a weekly session is delivered for each week that has an occurrence record (`deliveredWeekly` holds
 * "sessionId:weekStartDate"). Same definitions as the Scheduling > Billing tab, summed over the month.
 */
export function therapyBillingForMonth(
  sessions: BillableSession[],
  rates: BillingRate[],
  deliveredWeekly: Set<string>,
  month: string
): TherapyBilling {
  const out: TherapyBilling = {
    scheduled: 0,
    actual: 0,
    scheduledCommission: 0,
    actualCommission: 0,
    income: 0,
    scheduledIncome: 0,
    sessions: 0,
    delivered: 0,
    unrated: 0,
  }
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
    out.scheduledCommission += rate.commissionRate
    if (delivered) {
      out.actual += rate.billingRate
      out.actualCommission += rate.commissionRate
    }
  })
  // Therapy income = billing minus the teacher commission.
  out.income = out.actual - out.actualCommission
  out.scheduledIncome = out.scheduled - out.scheduledCommission
  return out
}

/** How many therapy sessions each child has on the calendar in the month (same sessions as the billing above). */
export function sessionsPerChildInMonth(sessions: BillableSession[], month: string): Map<string, number> {
  const perChild = new Map<string, number>()
  forEachOccurrence(sessions, month, (s) => perChild.set(s.student_id, (perChild.get(s.student_id) ?? 0) + 1))
  return perChild
}

// ── What became of the sessions ─────────────────────────────────────────────

export interface SessionOutcomes {
  /** On the calendar in the month and not cancelled: done + toCome + notDone (the sessions the billing above prices). */
  scheduled: number
  /** Delivered: a one-off marked Complete (its note was submitted), or a weekly session with an occurrence record. */
  done: number
  /** Still ahead: the session has not ended yet. */
  toCome: number
  /** Ended, but never marked complete and not cancelled: a no-show, or a note the teacher has not written yet. */
  notDone: number
  /** One-off sessions dated in the month that were cancelled. The app does not record who cancelled, or why. */
  cancelled: number
  /** One-off sessions dated in the month that the teacher declined. */
  declined: number
}

const emptyOutcomes = (): SessionOutcomes => ({ scheduled: 0, done: 0, toCome: 0, notDone: 0, cancelled: 0, declined: 0 })

/** The moment one occurrence ends: a one-off's end time, or a weekly session's end time on its date in that week. */
function occurrenceEnd(s: BillableSession, weekStart: string): Date | null {
  if (s.recurrence_type === 'weekly') {
    const date = sessionDateInWeek(s, weekStart)
    return date && s.time_of_day_end ? new Date(businessLocalToISOString(`${date}T${s.time_of_day_end.slice(0, 8)}`)) : null
  }
  return s.end_time ? new Date(s.end_time) : null
}

/**
 * What became of every session dated in the month (YYYY-MM), in total and for each child: how many are
 * on the calendar, how many of those are done, still to come, or ended without being marked complete, and
 * how many one-off sessions were cancelled or declined. `sessions` may hold any status; a weekly session only
 * counts while pending, accepted or completed (a cancelled weekly session has no dates left to count).
 * `deliveredWeekly` holds "sessionId:weekStartDate" for the weekly sessions with an occurrence record, `now`
 * decides what has already ended.
 */
export function sessionOutcomesForMonth(
  sessions: BillableSession[],
  deliveredWeekly: Set<string>,
  month: string,
  now: Date
): { total: SessionOutcomes; perChild: Map<string, SessionOutcomes> } {
  const total = emptyOutcomes()
  const perChild = new Map<string, SessionOutcomes>()
  const count = (studentId: string, field: keyof SessionOutcomes) => {
    total[field] += 1
    let child = perChild.get(studentId)
    if (!child) {
      child = emptyOutcomes()
      perChild.set(studentId, child)
    }
    child[field] += 1
  }

  const onCalendar = sessions.filter((s) => s.status === 'pending' || s.status === 'accepted' || s.status === 'completed')
  forEachOccurrence(onCalendar, month, (s, week) => {
    count(s.student_id, 'scheduled')
    const delivered = s.recurrence_type === 'weekly' ? deliveredWeekly.has(`${s.id}:${week}`) : s.status === 'completed'
    if (delivered) {
      count(s.student_id, 'done')
      return
    }
    const end = occurrenceEnd(s, week)
    count(s.student_id, end && end <= now ? 'notDone' : 'toCome')
  })

  const first = `${month}-01`
  const last = lastDayOf(month)
  for (const s of sessions) {
    if (s.recurrence_type !== 'one_off' || !s.start_time) continue
    if (s.status !== 'cancelled' && s.status !== 'declined') continue
    const date = dateStringInBusinessTz(new Date(s.start_time))
    if (date >= first && date <= last) count(s.student_id, s.status === 'cancelled' ? 'cancelled' : 'declined')
  }
  return { total, perChild }
}

// ── Per school ──────────────────────────────────────────────────────────────

export interface SchoolRow {
  name: string
  /** Montessori students enrolled this month. */
  enrolled: number
  /** Children with therapy switched on. */
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
    if (c.therapy_on) row.therapyClients += 1
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
