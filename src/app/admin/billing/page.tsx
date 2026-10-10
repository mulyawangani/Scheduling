/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/require-capability'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { commissionForSessions } from '@/lib/billing'
import { sessionOutcomesForMonth, weeksOverlappingMonth, type BillableSession } from '@/lib/dashboard/owner-stats'
import { businessLocalToISOString } from '@/lib/timezone'
import type { BillingRate } from '@/lib/supabase/types'
import { BackLink } from '@/components/back-link'
import Link from 'next/link'
import { PaymentStatusButton } from './payment-status-button'
import { SessionStrip, TherapyTable, type TherapyRow } from './therapy-table'

export const dynamic = 'force-dynamic'

const STATUS_ORDER: Record<string, number> = { unpaid: 0, pending: 1, paid: 2, failed: 3, refunded: 4 }
// Rows with no payment status (no sessions, or not enrolled) go after every row that has one.
const orderOf = (status: string | null) => (status === null ? 99 : (STATUS_ORDER[status] ?? 9))

const SCHOOL_STATUS_TAG: Record<string, string> = { student: 'Student', non_student: 'Non-student', trial: 'Trial', inactive: 'Inactive' }
const schoolStatusTag = (status: string | null) => (status ? (SCHOOL_STATUS_TAG[status] ?? status) : 'No status')

const CHILD_FIELDS = 'id, name, status, school_id, weekly_target_sessions, classrooms(name), profiles!students_parent_id_fkey(name, phone)'

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

const one = (v: any) => (Array.isArray(v) ? v[0] : v)

/**
 * Keeps one therapy_payments row per child per month in step with that month's submitted notes:
 * created as unpaid, or its session count and amount refreshed unless it is already paid.
 * The page calls this while it renders, so it is a plain function and not a server action: actions
 * end with revalidatePath, which Next.js refuses during a render (that crashed this page the first
 * time a Student child had a note). The rows are read right after, so nothing needs revalidating.
 */
async function syncTherapyPayment(db: any, studentId: string, schoolId: string | null, month: string, sessionCount: number, ratePerSession: number) {
  const { data: existing } = await db.from('therapy_payments').select('id, status').eq('student_id', studentId).eq('month', month).maybeSingle()
  const totalAmount = sessionCount * ratePerSession
  if (!existing) {
    await db.from('therapy_payments').insert({
      student_id: studentId,
      school_id: schoolId,
      month,
      session_count: sessionCount,
      rate_per_session: ratePerSession,
      total_amount: totalAmount,
      status: 'unpaid',
    })
  } else if (existing.status !== 'paid') {
    await db.from('therapy_payments').update({ session_count: sessionCount, rate_per_session: ratePerSession, total_amount: totalAmount }).eq('id', existing.id)
  }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tab?: string; filter?: string }>
}) {
  const { access } = await requireCapability('ops.billing')
  const { month: monthParam, tab: tabParam, filter } = await searchParams

  const today = new Date()
  const [year, mon] = monthParam
    ? monthParam.split('-').map(Number)
    : [today.getFullYear(), today.getMonth() + 1]
  const currentMonthStr = `${year}-${String(mon).padStart(2, '0')}`
  const monthStart = `${currentMonthStr}-01`
  const monthEnd = `${currentMonthStr}-${String(new Date(year, mon, 0).getDate()).padStart(2, '0')}`

  const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`
  const monthLabel = new Date(monthStart + 'T12:00:00').toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  const tab = tabParam ?? 'therapy'
  const supabase = await createClient()
  const db = supabase as any

  // ── Therapy ─────────────────────────────────────────────────────────────────
  // Every therapy client is listed: each child whose therapy is switched on, whatever their school status
  // (non-students included), with their sessions this month. A child with a submitted note this month is
  // listed even if therapy has since been switched off, so nothing already delivered is left out.
  // The month's sessions as they stand: every one-off dated in the month with any status (so cancelled ones can be
  // counted) and every weekly session that is on the calendar, plus which weeks of a weekly session were delivered.
  const sessionFields = 'id, student_id, teacher_id, status, recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end'
  const monthStartISO = businessLocalToISOString(`${monthStart}T00:00`)
  const nextMonthStartISO = businessLocalToISOString(`${nextMonth}-01T00:00`)

  const [{ data: therapyKids }, { data: therapyNotes }, { data: monthSessions }, { data: weeklySessions }, occurrenceRes] = await Promise.all([
    fetchAllRows<any>((from, to) =>
      db
        .from('students')
        .select('id, name, status, school_id, rate_per_session, classrooms(name), profiles!students_parent_id_fkey(name, phone)')
        .eq('therapy_on', true)
        .order('id')
        .range(from, to)
    ),
    // Notes for the month (submitted or approved — not draft)
    db
      .from('therapy_notes')
      .select('id, session_plan_id, teacher_id, session_date, status, session_plans(student_id, students(id, name, status, school_id, rate_per_session, classrooms(name), profiles!students_parent_id_fkey(name, phone)))')
      .gte('session_date', monthStart)
      .lte('session_date', monthEnd)
      .neq('status', 'draft'),
    fetchAllRows<BillableSession>((from, to) =>
      db
        .from('session_plans')
        .select(sessionFields)
        .eq('recurrence_type', 'one_off')
        .gte('start_time', monthStartISO)
        .lt('start_time', nextMonthStartISO)
        .order('id')
        .range(from, to)
    ),
    fetchAllRows<BillableSession>((from, to) =>
      db
        .from('session_plans')
        .select(sessionFields)
        .eq('recurrence_type', 'weekly')
        .in('status', ['pending', 'accepted', 'completed'])
        .order('id')
        .range(from, to)
    ),
    db.from('session_occurrences').select('session_plan_id, week_start_date').in('week_start_date', weeksOverlappingMonth(currentMonthStr)),
  ])

  const deliveredWeekly = new Set<string>(
    ((occurrenceRes.data ?? []) as { session_plan_id: string; week_start_date: string }[]).map((o) => `${o.session_plan_id}:${o.week_start_date}`)
  )
  const outcomes = sessionOutcomesForMonth([...(monthSessions ?? []), ...(weeklySessions ?? [])], deliveredWeekly, currentMonthStr, new Date())

  // Billing rates: fetch all and build lookup (student+teacher → rate, student+null → default)
  const { data: billingRatesData } = await db.from('billing_rates').select('*')
  const billingRates = (billingRatesData ?? []) as BillingRate[]

  const rateMap = new Map<string, number>()
  for (const r of billingRates) {
    const key = r.teacher_id ? `${r.student_id}:${r.teacher_id}` : `${r.student_id}:default`
    rateMap.set(key, r.billing_rate)
  }

  function getRate(studentId: string, teacherId: string, fallback: number | null): number {
    return rateMap.get(`${studentId}:${teacherId}`)
      ?? rateMap.get(`${studentId}:default`)
      ?? fallback
      ?? 0
  }

  // One entry per therapy client; the notes of the month fill in their sessions.
  const byStudent = new Map<string, { student: any; sessions: any[]; rate: number }>()
  for (const kid of therapyKids ?? []) {
    byStudent.set(kid.id, { student: kid, sessions: [], rate: getRate(kid.id, '', kid.rate_per_session) })
  }
  for (const note of therapyNotes ?? []) {
    const plan = one(note.session_plans)
    if (!plan) continue
    const student = one(plan.students)
    if (!student) continue

    // The first note's teacher decides the rate for the month, as before.
    const rate = getRate(student.id, note.teacher_id, student.rate_per_session)
    const entry = byStudent.get(student.id)
    if (!entry) {
      byStudent.set(student.id, { student, sessions: [note], rate })
    } else {
      if (entry.sessions.length === 0) entry.rate = rate
      entry.sessions.push(note)
    }
  }

  // Keep therapy_payments in sync with therapy_notes for every child with sessions this month
  // (silent, server-side; only for a role that may change payments).
  if (access === 'yes') {
    await Promise.all(
      Array.from(byStudent)
        .filter(([, entry]) => entry.sessions.length > 0)
        .map(([studentId, entry]) => syncTherapyPayment(db, studentId, entry.student.school_id ?? null, monthStart, entry.sessions.length, entry.rate))
    )
  }

  // Fetch therapy_payments for this month
  const { data: therapyPayments } = await db
    .from('therapy_payments')
    .select('student_id, month, session_count, rate_per_session, total_amount, status, xendit_payment_id, paid_at')
    .eq('month', monthStart)

  const therapyPayMap = new Map<string, any>()
  for (const p of therapyPayments ?? []) therapyPayMap.set(p.student_id, p)

  // Build therapy rows: a child with no session this month has no payment status.
  const therapyRows: TherapyRow[] = Array.from(byStudent.values()).map(({ student, sessions, rate }) => {
    const payment = therapyPayMap.get(student.id)
    const hasSessions = sessions.length > 0
    const became = outcomes.perChild.get(student.id)
    return {
      studentId: student.id as string,
      name: student.name as string,
      schoolStatusLabel: schoolStatusTag(student.status ?? null),
      classroom: one(student.classrooms)?.name ?? null,
      parent: one(student.profiles) ?? null,
      scheduled: became?.scheduled ?? 0,
      sessionCount: sessions.length,
      notDone: became?.notDone ?? 0,
      cancelled: became?.cancelled ?? 0,
      rate,
      total: sessions.length * rate,
      // Each done session at the commission rate of the teacher who taught it.
      commission: commissionForSessions(billingRates, student.id, sessions.map((n: any) => n.teacher_id as string)),
      status: hasSessions ? ((payment?.status ?? 'unpaid') as string) : null,
      paidAt: payment?.paid_at ?? null,
      xenditPaymentId: payment?.xendit_payment_id ?? null,
    }
  })
  therapyRows.sort((a, b) => orderOf(a.status) - orderOf(b.status) || a.name.localeCompare(b.name))

  const activeFilter = filter && filter !== 'all' ? filter : null
  const filteredTherapyRows = activeFilter ? therapyRows.filter(r => r.status === activeFilter) : therapyRows

  const tPaid    = therapyRows.filter(r => r.status === 'paid').length
  const tPending = therapyRows.filter(r => r.status === 'pending').length
  const tUnpaid  = therapyRows.filter(r => r.status === 'unpaid').length
  const tNone    = therapyRows.filter(r => r.status === null).length
  const tRevenue = therapyRows.filter(r => r.status === 'paid').reduce((s, r) => s + r.total, 0)

  // ── School (enrollment) payments ────────────────────────────────────────────
  // Every student is listed (status Student), plus any child enrolled in this month who has since been set
  // to Inactive (a graduated student), so a past month stays complete. Only a student enrolled for the month
  // owes a payment; the others show as not enrolled.
  const [{ data: studentKids }, enrollRes] = await Promise.all([
    fetchAllRows<any>((from, to) => db.from('students').select(CHILD_FIELDS).eq('status', 'student').order('id').range(from, to)),
    db.from('enrollments').select('student_id').eq('month', monthStart).eq('status', 'active'),
  ])
  const enrolledIds = new Set<string>(((enrollRes.data ?? []) as { student_id: string }[]).map((r) => r.student_id))
  const listed = new Map<string, any>((studentKids ?? []).map((k: any) => [k.id, k]))
  const strayIds = Array.from(enrolledIds).filter((id) => !listed.has(id))
  for (let i = 0; i < strayIds.length; i += 100) {
    const { data } = await db.from('students').select(CHILD_FIELDS).in('id', strayIds.slice(i, i + 100)).eq('status', 'inactive')
    for (const k of data ?? []) listed.set(k.id, k)
  }

  // The payments table is created by supabase/add_enrollment_payments.sql; until then the list still shows.
  const paymentColumns = 'student_id, month, amount, status, xendit_payment_id, paid_at'
  const payRes = await db.from('enrollment_payments').select(paymentColumns).eq('month', monthStart)
  const schoolPaymentsReady = !payRes.error
  let schoolPayments: any[] = payRes.data ?? []
  if (schoolPaymentsReady && access === 'yes') {
    const have = new Set(schoolPayments.map((p) => p.student_id))
    const missing = Array.from(listed.values())
      .filter((k) => enrolledIds.has(k.id) && !have.has(k.id))
      .map((k) => ({ student_id: k.id, school_id: k.school_id ?? null, month: monthStart, status: 'unpaid' }))
    if (missing.length > 0) {
      await db.from('enrollment_payments').upsert(missing, { onConflict: 'student_id,month', ignoreDuplicates: true })
      const again = await db.from('enrollment_payments').select(paymentColumns).eq('month', monthStart)
      schoolPayments = again.data ?? schoolPayments
    }
  }
  const schoolPayMap = new Map<string, any>(schoolPayments.map((p) => [p.student_id, p]))

  const schoolRows = Array.from(listed.values()).map((k: any) => {
    const enrolled = enrolledIds.has(k.id)
    const payment = schoolPayMap.get(k.id)
    return {
      studentId: k.id as string,
      name: k.name as string,
      schoolStatus: (k.status ?? null) as string | null,
      classroom: one(k.classrooms)?.name ?? null,
      parent: one(k.profiles) ?? null,
      weeklyTarget: k.weekly_target_sessions ?? null,
      enrolled,
      // No payment status for a student who is not enrolled, or while the payments table does not exist yet.
      status: enrolled && schoolPaymentsReady ? ((payment?.status ?? 'unpaid') as string) : null,
      paidAt: payment?.paid_at ?? null,
      xenditPaymentId: payment?.xendit_payment_id ?? null,
    }
  })
  schoolRows.sort((a, b) => Number(b.enrolled) - Number(a.enrolled) || orderOf(a.status) - orderOf(b.status) || a.name.localeCompare(b.name))

  const sPaid        = schoolRows.filter((r) => r.status === 'paid').length
  const sPending     = schoolRows.filter((r) => r.status === 'pending').length
  const sUnpaid      = schoolRows.filter((r) => r.status === 'unpaid').length
  const sNotEnrolled = schoolRows.filter((r) => !r.enrolled).length

  const TABS = [
    { key: 'therapy',          label: 'Therapy' },
    { key: 'school',           label: 'School' },
    { key: 'extracurricular',  label: 'Extracurricular' },
  ]
  const FILTERS = ['all', 'unpaid', 'pending', 'paid']
  const FILTER_COLOR: Record<string, string> = {
    unpaid: '#DC2626', pending: '#CA8A04', paid: '#16A34A', all: '#6B7280',
  }

  function tabHref(t: string) {
    return `/admin/billing?month=${currentMonthStr}&tab=${t}`
  }
  function filterHref(f: string) {
    return `/admin/billing?month=${currentMonthStr}&tab=${tab}&filter=${f}`
  }

  return (
    <main className="mx-auto max-w-6xl p-6 flex flex-col gap-6">
      <div>
        <BackLink href="/admin" label="Dashboard" />
        <h1 className="text-xl font-semibold mt-1">Billing</h1>
        <p className="text-xs text-gray-400 mt-0.5">Enrollment payments via Xendit</p>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/billing?month=${prevMonth}&tab=${tab}`} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors">‹</Link>
        <span className="text-base font-semibold text-gray-800 min-w-[160px] text-center">{monthLabel}</span>
        <Link href={`/admin/billing?month=${nextMonth}&tab=${tab}`} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors">›</Link>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
            style={{
              color: tab === t.key ? '#F59030' : '#6B7280',
              borderColor: tab === t.key ? '#F59030' : 'transparent',
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── THERAPY TAB ── */}
      {tab === 'therapy' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Unpaid',  value: tUnpaid,  color: '#DC2626' },
              { label: 'Pending', value: tPending, color: '#CA8A04' },
              { label: 'Paid',    value: tPaid,    color: '#16A34A' },
              { label: 'Revenue', value: `Rp ${fmt(tRevenue)}`, color: '#3B82F6' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs font-medium text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* What became of the month's sessions: scheduled, done, to come, not done, cancelled */}
          <SessionStrip monthLabel={monthLabel} outcomes={outcomes.total} />

          {/* Filter tabs */}
          <div className="flex gap-2">
            {FILTERS.map(f => {
              const isActive = (filter ?? 'all') === f
              const count = f === 'all' ? therapyRows.length : f === 'unpaid' ? tUnpaid : f === 'pending' ? tPending : tPaid
              return (
                <Link key={f} href={filterHref(f)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
                  style={{
                    background: isActive ? `${FILTER_COLOR[f]}18` : '#F9FAFB',
                    color: isActive ? FILTER_COLOR[f] : '#6B7280',
                    border: isActive ? `1px solid ${FILTER_COLOR[f]}40` : '1px solid #F3F4F6',
                  }}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                </Link>
              )
            })}
          </div>

          {therapyRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
              No child has therapy switched on yet.<br />
              <span className="text-xs">Switch therapy on in a child&apos;s profile on the Children page; they are then listed here.</span>
            </div>
          ) : (
            <TherapyTable rows={filteredTherapyRows} monthStart={monthStart} />
          )}

          <p className="text-xs leading-relaxed text-gray-400 text-center">
            Every child with therapy on is listed, non-students included ({tNone} with no sessions in {monthLabel}). Done counts the submitted therapy
            notes, and that is what is billed. Commission is each done session at its teacher&apos;s commission rate; a dash means no commission rate is
            set for that child and teacher. Click a status to cycle: Unpaid → Pending → Paid.
          </p>
        </>
      )}

      {/* ── SCHOOL TAB ── */}
      {tab === 'school' && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Unpaid',       value: sUnpaid,       color: '#DC2626' },
              { label: 'Pending',      value: sPending,      color: '#CA8A04' },
              { label: 'Paid',         value: sPaid,         color: '#16A34A' },
              { label: 'Not enrolled', value: sNotEnrolled,  color: '#6B7280' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs font-medium text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {!schoolPaymentsReady && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              School payments are not set up yet, so no payment status is shown. The students are listed; the statuses appear once the school payments
              table exists.
            </div>
          )}

          {schoolRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
              No students yet.<br />
              <span className="text-xs">A child with the status Student is listed here.</span>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Student</th>
                    <th className="px-3 py-3 text-left">Parent</th>
                    <th className="px-3 py-3 text-center">Sessions/wk</th>
                    <th className="px-3 py-3 text-right">Paid on</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolRows.map((r, i) => (
                    <tr key={r.studentId} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{r.name}</div>
                        <div className="text-xs text-gray-400">
                          {r.classroom ? `${r.classroom} · ` : ''}{schoolStatusTag(r.schoolStatus)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-gray-700">{r.parent?.name ?? '—'}</div>
                        {r.parent?.phone && <div className="text-xs text-gray-400">{r.parent.phone}</div>}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-gray-700">{r.weeklyTarget ?? '—'}</td>
                      <td className="px-3 py-3 text-right text-xs text-gray-500">
                        {r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {!r.enrolled ? (
                          <span className="text-xs text-gray-400">Not enrolled</span>
                        ) : r.status === null ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <PaymentStatusButton studentId={r.studentId} month={monthStart} status={r.status} type="school" xenditPaymentId={r.xenditPaymentId} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Every student is listed. Only a student enrolled for {monthLabel} owes a payment. Click a status to cycle: Unpaid → Pending → Paid.
          </p>
        </>
      )}

      {/* ── EXTRACURRICULAR TAB ── */}
      {tab === 'extracurricular' && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <div className="text-2xl mb-2">🎨</div>
          <div className="text-sm font-medium text-gray-500">Extracurricular billing coming soon</div>
          <div className="text-xs text-gray-400 mt-1">This section will track fees for activities outside the core therapy program.</div>
        </div>
      )}
    </main>
  )
}
