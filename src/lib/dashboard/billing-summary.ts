/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BillingRate, Database } from '@/lib/supabase/types'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { businessLocalToISOString, dateStringInBusinessTz } from '@/lib/timezone'
import {
  extracurricularExpected,
  therapyBillingForMonth,
  weeksOverlappingMonth,
  type BillableSession,
  type ExtracurricularExpected,
  type TherapyBilling,
} from './owner-stats'

export interface BillingSummary {
  /** YYYY-MM, in the business timezone. */
  month: string
  monthLabel: string
  /** Children with an active enrollment this month. */
  enrolledThisMonth: Set<string>
  /** The month's sessions (every weekly session, and the one-offs dated in the month), as read. */
  sessions: BillableSession[]
  therapy: TherapyBilling
  extra: ExtracurricularExpected
}

/**
 * The Billing box for the current month, shared by the Owner and the Admin home: therapy billing
 * scheduled and delivered, the teacher commission on it and the therapy income, plus what extracurricular
 * sign-ups come to. Reads only what an Owner or Admin may read.
 */
export async function loadBillingSummary(supabase: SupabaseClient<Database>): Promise<BillingSummary> {
  const db = supabase as any

  const month = dateStringInBusinessTz(new Date()).slice(0, 7)
  const monthStart = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const nextMonthStart = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`
  const startISO = businessLocalToISOString(`${monthStart}T00:00`)
  const endISO = businessLocalToISOString(`${nextMonthStart}T00:00`)
  const monthLabel = new Date(`${monthStart}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const weeks = weeksOverlappingMonth(month)

  const [enrolledRes, { data: rates }, { data: sessions }, occurrenceRes, signupRes] = await Promise.all([
    db.from('enrollments').select('student_id').eq('month', monthStart).eq('status', 'active'),
    fetchAllRows<BillingRate>((from, to) => supabase.from('billing_rates').select('*').order('id').range(from, to)),
    // Weekly sessions have no date of their own, so they are all read; a one-off only if it falls in the month.
    fetchAllRows<BillableSession>((from, to) =>
      db
        .from('session_plans')
        .select('id, student_id, teacher_id, status, recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end')
        .in('status', ['pending', 'accepted', 'completed'])
        .or(`recurrence_type.eq.weekly,and(start_time.gte.${startISO},start_time.lt.${endISO})`)
        .order('id')
        .range(from, to)
    ),
    db.from('session_occurrences').select('session_plan_id, week_start_date').in('week_start_date', weeks),
    db.from('student_extracurriculars').select('student_id, extracurricular_activities(monthly_price)'),
  ])

  const enrolledThisMonth = new Set<string>(((enrolledRes.data ?? []) as { student_id: string }[]).map((r) => r.student_id))
  const deliveredWeekly = new Set<string>(
    ((occurrenceRes.data ?? []) as { session_plan_id: string; week_start_date: string }[]).map((o) => `${o.session_plan_id}:${o.week_start_date}`)
  )
  type Signup = { student_id: string; extracurricular_activities: { monthly_price: number | null } | { monthly_price: number | null }[] | null }

  return {
    month,
    monthLabel,
    enrolledThisMonth,
    sessions: sessions ?? [],
    therapy: therapyBillingForMonth(sessions ?? [], rates ?? [], deliveredWeekly, month),
    extra: extracurricularExpected(
      ((signupRes.data ?? []) as Signup[]).map((s) => {
        const activity = Array.isArray(s.extracurricular_activities) ? s.extracurricular_activities[0] : s.extracurricular_activities
        return { student_id: s.student_id, monthly_price: activity?.monthly_price ?? null }
      }),
      enrolledThisMonth
    ),
  }
}
