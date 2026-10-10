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
}

export interface ChildSummary {
  /** Montessori school students. Active = enrolled this month. */
  students: { active: number; inactive: number }
  /** Therapy-only clients (status Non-student). Active = not set to Inactive. */
  therapyClients: { active: number; inactive: number }
  trial: number
  noStatus: number
  total: number
}

/**
 * Splits the children into Montessori students and therapy clients, each active or inactive.
 *
 * A Student is active when enrolled for the month and inactive otherwise. A Non-student is an active
 * therapy client. A child set to Inactive no longer says which kind they were, so they count as a
 * student when they have a classroom or any enrollment on record, and as a therapy client otherwise.
 * Trial children and children with no status are counted on their own.
 */
export function summarizeChildren(children: ChildRow[], enrolledThisMonth: Set<string>, everEnrolled: Set<string>): ChildSummary {
  const out: ChildSummary = {
    students: { active: 0, inactive: 0 },
    therapyClients: { active: 0, inactive: 0 },
    trial: 0,
    noStatus: 0,
    total: children.length,
  }
  for (const c of children) {
    if (c.status === 'student') {
      if (enrolledThisMonth.has(c.id)) out.students.active += 1
      else out.students.inactive += 1
    } else if (c.status === 'non_student') {
      out.therapyClients.active += 1
    } else if (c.status === 'inactive') {
      if (c.classroom_id || everEnrolled.has(c.id)) out.students.inactive += 1
      else out.therapyClients.inactive += 1
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
  const first = `${month}-01`
  const last = lastDayOf(month)
  const weeks = weeksOverlappingMonth(month)

  const out: TherapyBilling = { scheduled: 0, actual: 0, sessions: 0, delivered: 0, unrated: 0 }
  const count = (s: BillableSession, delivered: boolean) => {
    out.sessions += 1
    if (delivered) out.delivered += 1
    const rate = lookupBillingRate(rates, s.student_id, s.teacher_id)
    if (!rate) {
      out.unrated += 1
      return
    }
    out.scheduled += rate.billingRate
    if (delivered) out.actual += rate.billingRate
  }

  for (const s of sessions) {
    if (s.recurrence_type === 'weekly') {
      for (const w of weeks) {
        const date = sessionDateInWeek(s, w)
        if (date && date >= first && date <= last) count(s, deliveredWeekly.has(`${s.id}:${w}`))
      }
    } else if (s.start_time) {
      const date = dateStringInBusinessTz(new Date(s.start_time))
      if (date >= first && date <= last && sessionDateInWeek(s, getWeekStart(new Date(s.start_time)))) count(s, s.status === 'completed')
    }
  }
  return out
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
