import type { SessionOutcomes } from '@/lib/dashboard/owner-stats'
import { PaymentStatusButton } from './payment-status-button'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)

export interface TherapyRow {
  studentId: string
  name: string
  /** The child's school status, already worded for display ("Student", "Non-student", "No status"). */
  schoolStatusLabel: string
  classroom: string | null
  parent: { name?: string | null; phone?: string | null } | null
  /** On the calendar this month and not cancelled. */
  scheduled: number
  /** Sessions with a submitted note: what is billed. */
  sessionCount: number
  /** Ended without being marked complete: a no-show, or a note not written yet. */
  notDone: number
  cancelled: number
  rate: number
  total: number
  /** Teacher commission on the done sessions; null when one of them has no commission rate set. */
  commission: number | null
  status: string | null
  paidAt: string | null
  xenditPaymentId: string | null
}

const Zero = () => <span className="text-gray-300">—</span>

/** One row per therapy client for the month: what was booked, what was done, what was billed and the commission on it. */
export function TherapyTable({ rows, monthStart }: { rows: TherapyRow[]; monthStart: string }) {
  const sum = (pick: (r: TherapyRow) => number) => rows.reduce((s, r) => s + pick(r), 0)

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <th className="px-5 py-3 text-left">Student</th>
            <th className="px-3 py-3 text-left">Parent</th>
            <th className="whitespace-nowrap px-2 py-3 text-center" title="Sessions on the calendar this month that are not cancelled: done, still to come, or ended without being marked complete.">
              Scheduled
            </th>
            <th className="whitespace-nowrap px-2 py-3 text-center" title="Sessions with a submitted therapy note. This is what is billed.">
              Done
            </th>
            <th className="whitespace-nowrap px-2 py-3 text-center" title="The session time has passed but it was never marked complete: a no-show, or the teacher has not written the note yet.">
              Not done
            </th>
            <th className="whitespace-nowrap px-2 py-3 text-center" title="Sessions dated this month that were cancelled. The app does not record who cancelled or why.">
              Cancelled
            </th>
            <th className="px-3 py-3 text-right">Rate</th>
            <th className="px-3 py-3 text-right">Total</th>
            <th className="px-3 py-3 text-right" title="The teachers' commission on the done sessions, each at the commission rate of the teacher who taught it.">
              Commission
            </th>
            <th className="whitespace-nowrap px-3 py-3 text-right">Paid on</th>
            <th className="px-5 py-3 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.studentId} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
              <td className="px-5 py-3">
                <div className="whitespace-nowrap font-medium text-gray-900">{r.name}</div>
                <div className="text-xs text-gray-400">
                  {r.classroom ? `${r.classroom} · ` : ''}
                  {r.schoolStatusLabel}
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="whitespace-nowrap text-gray-700">{r.parent?.name ?? '—'}</div>
                {r.parent?.phone && <div className="whitespace-nowrap text-xs text-gray-400">{r.parent.phone}</div>}
              </td>
              <td className="px-2 py-3 text-center tabular-nums text-gray-700">{r.scheduled > 0 ? r.scheduled : <Zero />}</td>
              <td className="px-2 py-3 text-center font-semibold tabular-nums text-gray-700">{r.sessionCount}</td>
              <td className="px-2 py-3 text-center tabular-nums">
                {r.notDone > 0 ? <span className="font-semibold" style={{ color: '#B45309' }}>{r.notDone}</span> : <Zero />}
              </td>
              <td className="px-2 py-3 text-center tabular-nums">
                {r.cancelled > 0 ? <span className="font-semibold" style={{ color: '#DC2626' }}>{r.cancelled}</span> : <Zero />}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-xs tabular-nums text-gray-500">{r.rate > 0 ? `Rp ${fmt(r.rate)}` : '—'}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-gray-800">
                {r.total > 0 ? `Rp ${fmt(r.total)}` : '—'}
              </td>
              <td
                className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-gray-600"
                title={r.commission === null && r.sessionCount > 0 ? 'No commission rate is set for this child and teacher.' : undefined}
              >
                {r.sessionCount > 0 && r.commission !== null ? `Rp ${fmt(r.commission)}` : '—'}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-xs text-gray-500">
                {r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
              </td>
              <td className="px-5 py-3 text-right">
                {r.status === null ? (
                  <span className="whitespace-nowrap text-xs text-gray-400">No sessions</span>
                ) : (
                  <PaymentStatusButton studentId={r.studentId} month={monthStart} status={r.status} type="therapy" xenditPaymentId={r.xenditPaymentId} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-100 bg-gray-50/50 font-bold text-gray-800">
            <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-gray-500">
              Total
            </td>
            <td className="px-2 py-3 text-center tabular-nums">{sum((r) => r.scheduled)}</td>
            <td className="px-2 py-3 text-center tabular-nums">{sum((r) => r.sessionCount)}</td>
            <td className="px-2 py-3 text-center tabular-nums">{sum((r) => r.notDone)}</td>
            <td className="px-2 py-3 text-center tabular-nums">{sum((r) => r.cancelled)}</td>
            <td />
            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">Rp {fmt(sum((r) => r.total))}</td>
            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">Rp {fmt(sum((r) => r.commission ?? 0))}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** The month's sessions in one line of small tiles: what is on the calendar, what became of it, and what was cancelled. */
export function SessionStrip({ monthLabel, outcomes }: { monthLabel: string; outcomes: SessionOutcomes }) {
  const tiles = [
    { label: 'Scheduled', value: outcomes.scheduled, color: '#374151' },
    { label: 'Done', value: outcomes.done, color: '#16A34A' },
    { label: 'To come', value: outcomes.toCome, color: '#3B82F6' },
    { label: 'Not done', value: outcomes.notDone, color: '#B45309' },
    { label: 'Cancelled', value: outcomes.cancelled, color: '#DC2626' },
    { label: 'Declined', value: outcomes.declined, color: '#6B7280' },
  ]
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Sessions · {monthLabel}</h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-lg font-bold tabular-nums" style={{ color: t.color }}>
              {t.value}
            </div>
            <div className="mt-0.5 text-xs font-medium text-gray-400">{t.label}</div>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-gray-400">
        Scheduled is what is on the calendar (cancelled and declined sessions are not in it): done, still to come, or ended without being marked
        complete. Not done is a session whose time has passed without a note: a no-show, or a note the teacher has not written yet. The app does not
        record no-shows, or who cancelled a session and why, and Cancelled also counts sessions removed when a schedule was reset.
      </p>
    </section>
  )
}
