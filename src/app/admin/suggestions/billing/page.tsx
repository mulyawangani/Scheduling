import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { generateSchedule } from '@/lib/matching/generate-schedule'
import { lookupBillingRate } from '@/lib/billing'
import { getWeekStart, addWeeks, formatWeekLabel, getUpcomingWeekStart, dateForDayOfWeek } from '@/lib/week'
import { dateStringInBusinessTz } from '@/lib/timezone'
import { BackLink } from '@/components/back-link'
import { CollapsibleSection } from '@/components/collapsible-section'
import { SuggestionsNav } from '../suggestions-nav'
import { RateManager, type RateRow } from './rate-manager'

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

interface DeliveredRow {
  teacherId: string
  teacherName: string
  studentName: string
  protocolName: string
  billingRate: number | null
  commissionRate: number | null
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams
  const weekStartDate = week ? getWeekStart(new Date(`${week}T00:00:00Z`)) : getUpcomingWeekStart()
  const supabase = await createClient()

  const [{ data: studentRows }, { data: teacherRows }, { data: rateRows }, { data: allSessions }, { data: occurrenceRows }, schedule] =
    await Promise.all([
      supabase.from('students').select('id, name, status').order('name'),
      supabase.from('profiles').select('id, name').eq('role', 'teacher').order('name'),
      supabase.from('billing_rates').select('*'),
      supabase
        .from('session_plans')
        .select(
          'id, teacher_id, student_id, recurrence_type, start_time, status, students(name), protocols(title), profiles!session_plans_teacher_id_fkey(name)'
        ),
      supabase.from('session_occurrences').select('session_plan_id').eq('week_start_date', weekStartDate),
      generateSchedule(supabase, weekStartDate),
    ])

  const students = (studentRows ?? []).filter((s) => s.status !== 'inactive')
  const teachers = teacherRows ?? []
  const rates = rateRows ?? []
  const teacherNameById = new Map(teachers.map((t) => [t.id, t.name]))
  const studentNameById = new Map(students.map((s) => [s.id, s.name]))

  const rateDisplayRows: RateRow[] = rates.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: studentNameById.get(r.student_id) ?? 'Unknown student',
    teacherId: r.teacher_id,
    teacherName: r.teacher_id ? (teacherNameById.get(r.teacher_id) ?? 'Unknown teacher') : null,
    billingRate: r.billing_rate,
    commissionRate: r.commission_rate,
  }))

  // Estimated: what the currently-proposed (not yet booked) schedule for
  // this week would bill and pay out, if approved as-is.
  let estimatedBilling = 0
  let estimatedCommission = 0
  let estimatedUnrated = 0
  for (const p of schedule.proposals) {
    const rate = lookupBillingRate(rates, p.studentId, p.teacherId)
    if (!rate) {
      estimatedUnrated += 1
      continue
    }
    estimatedBilling += rate.billingRate
    estimatedCommission += rate.commissionRate
  }

  // Actual: sessions genuinely delivered this week — a one-off marked
  // Complete whose date falls in this week, or a weekly session with an
  // occurrence record for this exact week. Same "delivered" definition used
  // by Reports and the teacher's own Commissions tab.
  const sessionInfoById = new Map(
    (allSessions ?? []).map((s) => [
      s.id,
      {
        teacherId: s.teacher_id,
        teacherName: (Array.isArray(s.profiles) ? s.profiles[0]?.name : s.profiles?.name) ?? 'Unknown teacher',
        studentId: s.student_id,
        studentName: (Array.isArray(s.students) ? s.students[0]?.name : s.students?.name) ?? 'Unknown student',
        protocolName: (Array.isArray(s.protocols) ? s.protocols[0]?.title : s.protocols?.title) ?? 'Unknown protocol',
      },
    ])
  )

  const fridayDate = dateForDayOfWeek(weekStartDate, 5)
  const deliveredIds: string[] = []
  for (const s of allSessions ?? []) {
    if (s.recurrence_type !== 'one_off' || s.status !== 'completed' || !s.start_time) continue
    const d = dateStringInBusinessTz(new Date(s.start_time))
    if (d >= weekStartDate && d <= fridayDate) deliveredIds.push(s.id)
  }
  for (const o of occurrenceRows ?? []) deliveredIds.push(o.session_plan_id)

  const deliveredRows: DeliveredRow[] = []
  let actualBilling = 0
  let actualCommission = 0
  let actualUnrated = 0
  for (const id of deliveredIds) {
    const info = sessionInfoById.get(id)
    if (!info) continue
    const rate = lookupBillingRate(rates, info.studentId, info.teacherId)
    if (rate) {
      actualBilling += rate.billingRate
      actualCommission += rate.commissionRate
    } else {
      actualUnrated += 1
    }
    deliveredRows.push({
      teacherId: info.teacherId,
      teacherName: info.teacherName,
      studentName: info.studentName,
      protocolName: info.protocolName,
      billingRate: rate?.billingRate ?? null,
      commissionRate: rate?.commissionRate ?? null,
    })
  }

  const byTeacher = new Map<string, { teacherName: string; rows: DeliveredRow[]; billing: number; commission: number }>()
  for (const row of deliveredRows) {
    const entry = byTeacher.get(row.teacherId) ?? { teacherName: row.teacherName, rows: [], billing: 0, commission: 0 }
    entry.rows.push(row)
    entry.billing += row.billingRate ?? 0
    entry.commission += row.commissionRate ?? 0
    byTeacher.set(row.teacherId, entry)
  }
  const teacherBreakdown = Array.from(byTeacher.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName))

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Scheduling</h1>
      <SuggestionsNav active="/admin/suggestions/billing" />

      <div className="mb-6 flex items-center gap-3 text-sm">
        <Link href={`/admin/suggestions/billing?week=${addWeeks(weekStartDate, -1)}`} className="text-blue-600 hover:underline">
          ← Prev week
        </Link>
        <span className="font-medium text-gray-700">Week of {formatWeekLabel(weekStartDate)}</span>
        <Link href={`/admin/suggestions/billing?week=${addWeeks(weekStartDate, 1)}`} className="text-blue-600 hover:underline">
          Next week →
        </Link>
      </div>

      <section className="mb-8">
        <CollapsibleSection title="Rates — billing and commission per child" defaultOpen={false}>
          <p className="mb-3 text-sm text-gray-500">
            What a family is billed and a teacher earns per session, set per child. A specific teacher&apos;s own rate
            wins when set; otherwise the child&apos;s default rate applies to whichever teacher delivers her session.
          </p>
          <RateManager rates={rateDisplayRows} students={students.map((s) => ({ id: s.id, name: s.name }))} teachers={teachers} />
        </CollapsibleSection>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-medium text-gray-700">Estimated — this week&apos;s proposed schedule</h2>
        <p className="mb-3 text-sm text-gray-500">
          What this week would bill and pay out if the {schedule.proposals.length} currently-proposed session
          {schedule.proposals.length === 1 ? '' : 's'} on Simulations {schedule.proposals.length === 1 ? 'is' : 'are'} approved as-is.
          Nothing here is booked yet.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{currencyFormatter.format(estimatedBilling)}</p>
            <p className="text-sm text-gray-500">Estimated billing</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{currencyFormatter.format(estimatedCommission)}</p>
            <p className="text-sm text-gray-500">Estimated commission</p>
          </div>
        </div>
        {estimatedUnrated > 0 && (
          <p className="mt-2 text-xs text-amber-600">
            {estimatedUnrated} proposed session{estimatedUnrated === 1 ? '' : 's'} excluded — no rate set for that
            child yet.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-gray-700">Actual — delivered this week</h2>
        <p className="mb-3 text-sm text-gray-500">
          A one-off session once it&apos;s marked Complete, a weekly session once that week&apos;s occurrence is marked
          Complete — real money, not an estimate.
        </p>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{currencyFormatter.format(actualBilling)}</p>
            <p className="text-sm text-gray-500">Actual billing</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{currencyFormatter.format(actualCommission)}</p>
            <p className="text-sm text-gray-500">Actual commission</p>
          </div>
        </div>
        {actualUnrated > 0 && (
          <p className="mb-3 text-xs text-amber-600">
            {actualUnrated} delivered session{actualUnrated === 1 ? '' : 's'} excluded from the totals above — no rate
            set for that child yet.
          </p>
        )}

        {teacherBreakdown.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing delivered this week yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {teacherBreakdown.map((t) => (
              <div key={t.teacherName} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{t.teacherName}</p>
                  <p className="text-sm text-gray-500">
                    {currencyFormatter.format(t.commission)} commission · {currencyFormatter.format(t.billing)} billed
                  </p>
                </div>
                <ul className="flex flex-col gap-1">
                  {t.rows.map((row, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span>
                        {row.protocolName} — {row.studentName}
                      </span>
                      <span className={row.commissionRate === null ? 'text-amber-600' : 'text-gray-600'}>
                        {row.commissionRate === null ? 'no rate set' : currencyFormatter.format(row.commissionRate)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
