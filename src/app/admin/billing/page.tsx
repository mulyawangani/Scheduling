/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireAdminOrOwner } from '@/lib/auth/require-admin-or-owner'
import { BackLink } from '@/components/back-link'
import Link from 'next/link'
import { PaymentStatusButton } from './payment-status-button'
import { upsertTherapyPayment } from './actions'

export const dynamic = 'force-dynamic'

const STATUS_ORDER: Record<string, number> = { unpaid: 0, pending: 1, paid: 2, failed: 3, refunded: 4 }

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tab?: string; filter?: string }>
}) {
  await requireAdminOrOwner()
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

  // ── Therapy reconciliation ──────────────────────────────────────────────────
  // Fetch therapy notes for the month (submitted or approved — not draft)
  const { data: therapyNotes } = await supabase
    .from('therapy_notes')
    .select('id, session_plan_id, teacher_id, session_date, status, session_plans(student_id, students(id, name, status, school_id, rate_per_session, classrooms(name), profiles!students_parent_id_fkey(name, phone)))')
    .gte('session_date', monthStart)
    .lte('session_date', monthEnd)
    .neq('status', 'draft')

  // Billing rates: fetch all and build lookup (student+teacher → rate, student+null → default)
  const { data: billingRates } = await supabase
    .from('billing_rates')
    .select('student_id, teacher_id, billing_rate')

  const rateMap = new Map<string, number>()
  for (const r of billingRates ?? []) {
    const key = r.teacher_id ? `${r.student_id}:${r.teacher_id}` : `${r.student_id}:default`
    rateMap.set(key, r.billing_rate)
  }

  function getRate(studentId: string, teacherId: string, fallback: number | null): number {
    return rateMap.get(`${studentId}:${teacherId}`)
      ?? rateMap.get(`${studentId}:default`)
      ?? fallback
      ?? 0
  }

  // Group notes by student
  const byStudent = new Map<string, { student: any; sessions: any[]; rate: number }>()
  for (const note of therapyNotes ?? []) {
    const plan = Array.isArray(note.session_plans) ? note.session_plans[0] : note.session_plans
    if (!plan) continue
    const student = Array.isArray(plan.students) ? plan.students[0] : plan.students
    if (!student || student.status !== 'student') continue

    const rate = getRate(student.id, note.teacher_id, student.rate_per_session)
    const entry = byStudent.get(student.id)
    if (!entry) {
      byStudent.set(student.id, { student, sessions: [note], rate })
    } else {
      entry.sessions.push(note)
    }
  }

  // Upsert therapy_payments rows for all students with sessions this month
  // (runs server-side silently — keeps therapy_payments in sync with therapy_notes)
  for (const [studentId, entry] of byStudent) {
    await upsertTherapyPayment(
      studentId,
      entry.student.school_id ?? null,
      monthStart,
      entry.sessions.length,
      entry.rate,
    )
  }

  // Fetch therapy_payments for this month
  const { data: therapyPayments } = await db
    .from('therapy_payments')
    .select('student_id, month, session_count, rate_per_session, total_amount, status, xendit_payment_id, paid_at')
    .eq('month', monthStart)

  const therapyPayMap = new Map<string, any>()
  for (const p of therapyPayments ?? []) therapyPayMap.set(p.student_id, p)

  // Build therapy rows
  let therapyRows = Array.from(byStudent.values()).map(({ student, sessions, rate }) => {
    const payment = therapyPayMap.get(student.id)
    const classroom = student.classrooms
      ? (Array.isArray(student.classrooms) ? student.classrooms[0]?.name : student.classrooms?.name)
      : null
    const parent = student.profiles
      ? (Array.isArray(student.profiles) ? student.profiles[0] : student.profiles)
      : null
    return {
      studentId: student.id,
      name: student.name,
      classroom,
      parent,
      sessionCount: sessions.length,
      rate,
      total: sessions.length * rate,
      status: payment?.status ?? 'unpaid',
      paidAt: payment?.paid_at ?? null,
      xenditPaymentId: payment?.xendit_payment_id ?? null,
    }
  })
  therapyRows.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.name.localeCompare(b.name))

  const activeFilter = filter && filter !== 'all' ? filter : null
  const filteredTherapyRows = activeFilter ? therapyRows.filter(r => r.status === activeFilter) : therapyRows

  const tPaid    = therapyRows.filter(r => r.status === 'paid').length
  const tPending = therapyRows.filter(r => r.status === 'pending').length
  const tUnpaid  = therapyRows.filter(r => r.status === 'unpaid').length
  const tRevenue = therapyRows.filter(r => r.status === 'paid').reduce((s, r) => s + r.total, 0)
  const tTotal   = therapyRows.reduce((s, r) => s + r.total, 0)

  // ── School (enrollment) payments ────────────────────────────────────────────
  const { data: schoolPayments } = await db
    .from('enrollment_payments')
    .select(`
      student_id, month, amount, status, xendit_payment_id, paid_at,
      students!enrollment_payments_student_id_fkey(id, name, status, weekly_target_sessions, classrooms(name), profiles!students_parent_id_fkey(name, phone))
    `)
    .eq('month', monthStart)

  const schoolRows = (schoolPayments ?? [])
    .filter((p: any) => {
      const s = Array.isArray(p.students) ? p.students[0] : p.students
      return s?.status === 'student'
    })
    .sort((a: any, b: any) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))

  const sPaid    = schoolRows.filter((r: any) => r.status === 'paid').length
  const sPending = schoolRows.filter((r: any) => r.status === 'pending').length
  const sUnpaid  = schoolRows.filter((r: any) => r.status === 'unpaid').length

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
    <main className="mx-auto max-w-5xl p-6 flex flex-col gap-6">
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
              No submitted therapy notes found for {monthLabel}.<br />
              <span className="text-xs">Sessions appear here once a teacher submits their therapy notes.</span>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Student</th>
                    <th className="px-3 py-3 text-left">Parent</th>
                    <th className="px-3 py-3 text-center">Sessions</th>
                    <th className="px-3 py-3 text-right">Rate</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3 text-right">Paid on</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTherapyRows.map((r, i) => (
                    <tr key={r.studentId} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{r.name}</div>
                        {r.classroom && <div className="text-xs text-gray-400">{r.classroom}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-gray-700">{r.parent?.name ?? '—'}</div>
                        {r.parent?.phone && <div className="text-xs text-gray-400">{r.parent.phone}</div>}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-gray-700">{r.sessionCount}</td>
                      <td className="px-3 py-3 text-right text-xs text-gray-500">
                        {r.rate > 0 ? `Rp ${fmt(r.rate)}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-gray-800">
                        {r.total > 0 ? `Rp ${fmt(r.total)}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-gray-500">
                        {r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <PaymentStatusButton studentId={r.studentId} month={monthStart} status={r.status} type="therapy" xenditPaymentId={r.xenditPaymentId} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-100 bg-gray-50/50">
                    <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-gray-500">Total</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-800">Rp {fmt(tTotal)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Sessions are counted from submitted therapy notes. Click a status to cycle: Unpaid → Pending → Paid.
          </p>
        </>
      )}

      {/* ── SCHOOL TAB ── */}
      {tab === 'school' && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Unpaid',  value: sUnpaid,          color: '#DC2626' },
              { label: 'Pending', value: sPending,         color: '#CA8A04' },
              { label: 'Paid',    value: sPaid,            color: '#16A34A' },
              { label: 'Total',   value: schoolRows.length, color: '#3B82F6' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs font-medium text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {schoolRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
              No school enrollment payments for {monthLabel}.<br />
              <span className="text-xs">Run the billing SQL migration first if this is empty.</span>
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
                  {schoolRows.map((p: any, i: number) => {
                    const student = Array.isArray(p.students) ? p.students[0] : p.students
                    const parent = student?.profiles ? (Array.isArray(student.profiles) ? student.profiles[0] : student.profiles) : null
                    const classroom = student?.classrooms ? (Array.isArray(student.classrooms) ? student.classrooms[0]?.name : student.classrooms?.name) : null
                    return (
                      <tr key={p.student_id} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                        <td className="px-5 py-3">
                          <div className="font-medium text-gray-900">{student?.name ?? '—'}</div>
                          {classroom && <div className="text-xs text-gray-400">{classroom}</div>}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-gray-700">{parent?.name ?? '—'}</div>
                          {parent?.phone && <div className="text-xs text-gray-400">{parent.phone}</div>}
                        </td>
                        <td className="px-3 py-3 text-center font-semibold text-gray-700">
                          {student?.weekly_target_sessions ?? '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-gray-500">
                          {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <PaymentStatusButton studentId={p.student_id} month={p.month} status={p.status} type="school" xenditPaymentId={p.xendit_payment_id} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
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
