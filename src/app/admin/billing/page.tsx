/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireAdminOrOwner } from '@/lib/auth/require-admin-or-owner'
import { BackLink } from '@/components/back-link'
import Link from 'next/link'
import { PaymentStatusButton } from './payment-status-button'

export const dynamic = 'force-dynamic'

const STATUS_ORDER: Record<string, number> = { unpaid: 0, pending: 1, paid: 2, failed: 3, refunded: 4 }

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; filter?: string }>
}) {
  await requireAdminOrOwner()
  const { month: monthParam, filter } = await searchParams

  const today = new Date()
  const [year, mon] = monthParam
    ? monthParam.split('-').map(Number)
    : [today.getFullYear(), today.getMonth() + 1]
  const currentMonthStr = `${year}-${String(mon).padStart(2, '0')}`
  const monthStart = `${currentMonthStr}-01`

  const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`
  const monthLabel = new Date(monthStart + 'T12:00:00').toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  const supabase = await createClient()
  const db = supabase as any

  // All payments for this month joined with student info
  const { data: payments } = await db
    .from('enrollment_payments')
    .select(`
      id,
      student_id,
      month,
      amount,
      currency,
      status,
      xendit_invoice_id,
      xendit_payment_id,
      xendit_invoice_url,
      paid_at,
      notes,
      students!enrollment_payments_student_id_fkey(
        id, name, status, weekly_target_sessions,
        classrooms(name),
        profiles!students_parent_id_fkey(name, phone)
      )
    `)
    .eq('month', monthStart)
    .order('created_at')

  // Filter to active students only
  const allRows = (payments ?? []).filter((p: any) => {
    const s = Array.isArray(p.students) ? p.students[0] : p.students
    return s?.status === 'student'
  })

  // Apply status filter
  const activeFilter = filter && filter !== 'all' ? filter : null
  const rows = activeFilter ? allRows.filter((p: any) => p.status === activeFilter) : allRows

  // Sort: unpaid first, then pending, then paid
  rows.sort((a: any, b: any) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))

  // Stats
  const paid    = allRows.filter((p: any) => p.status === 'paid').length
  const pending = allRows.filter((p: any) => p.status === 'pending').length
  const unpaid  = allRows.filter((p: any) => p.status === 'unpaid').length
  const totalRevenue = allRows
    .filter((p: any) => p.status === 'paid' && p.amount)
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0)

  const FILTERS = ['all', 'unpaid', 'pending', 'paid']
  const FILTER_COLOR: Record<string, string> = {
    unpaid: '#DC2626', pending: '#CA8A04', paid: '#16A34A', all: '#6B7280',
  }

  return (
    <main className="mx-auto max-w-4xl p-6 flex flex-col gap-6">
      <div>
        <BackLink href="/admin" label="Dashboard" />
        <h1 className="text-xl font-semibold mt-1">Billing</h1>
        <p className="text-xs text-gray-400 mt-0.5">Enrollment payments via Xendit</p>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/billing?month=${prevMonth}`} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors">‹</Link>
        <span className="text-base font-semibold text-gray-800 min-w-[160px] text-center">{monthLabel}</span>
        <Link href={`/admin/billing?month=${nextMonth}`} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors">›</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Unpaid',  value: unpaid,  color: '#DC2626' },
          { label: 'Pending', value: pending, color: '#CA8A04' },
          { label: 'Paid',    value: paid,    color: '#16A34A' },
          { label: 'Total',   value: allRows.length, color: '#3B82F6' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs font-medium text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTERS.map(f => {
          const isActive = (filter ?? 'all') === f
          return (
            <Link
              key={f}
              href={`/admin/billing?month=${currentMonthStr}&filter=${f}`}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
              style={{
                background: isActive ? `${FILTER_COLOR[f]}18` : '#F9FAFB',
                color: isActive ? FILTER_COLOR[f] : '#6B7280',
                border: isActive ? `1px solid ${FILTER_COLOR[f]}40` : '1px solid #F3F4F6',
              }}
            >
              {f === 'all' ? `All (${allRows.length})` : f === 'unpaid' ? `Unpaid (${unpaid})` : f === 'pending' ? `Pending (${pending})` : `Paid (${paid})`}
            </Link>
          )
        })}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          No {activeFilter ?? ''} payments for {monthLabel}.
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
              {rows.map((p: any, i: number) => {
                const student = Array.isArray(p.students) ? p.students[0] : p.students
                const parent = student?.profiles
                  ? (Array.isArray(student.profiles) ? student.profiles[0] : student.profiles)
                  : null
                const classroom = student?.classrooms
                  ? (Array.isArray(student.classrooms) ? student.classrooms[0]?.name : student.classrooms?.name)
                  : null

                return (
                  <tr key={p.id} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{student?.name ?? '—'}</div>
                      {classroom && <div className="text-xs text-gray-400">{classroom}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-gray-700">{parent?.name ?? '—'}</div>
                      {parent?.phone && <div className="text-xs text-gray-400">{parent.phone}</div>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {student?.weekly_target_sessions != null ? (
                        <span className="font-semibold text-gray-700">{student.weekly_target_sessions}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-gray-500">
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <PaymentStatusButton
                        studentId={p.student_id}
                        month={p.month}
                        status={p.status}
                        xenditPaymentId={p.xendit_payment_id}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Click a status badge to cycle: Unpaid → Pending → Paid → Unpaid. Xendit webhooks will auto-update status when connected.
      </p>
    </main>
  )
}
