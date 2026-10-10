import { formatRupiah } from '@/lib/money'
import type { ExtracurricularExpected, TherapyBilling } from '@/lib/dashboard/owner-stats'
import { Box, Hint } from './dashboard-parts'

type Line = {
  label: string
  scheduled: string | null
  actual: string | null
  actualNote: string | null
  income: string | null
  incomeNote: string | null
}

/**
 * The month's money at a glance, on the Owner's and the Admin's home: therapy billing scheduled and
 * delivered, the therapy income on what was delivered (billing minus the teacher commission), and what
 * the extracurricular sign-ups come to. A table on wide screens, a stacked list on a phone.
 */
export function BillingBox({
  monthLabel,
  therapy,
  extra,
  wide = false,
}: {
  monthLabel: string
  therapy: TherapyBilling
  extra: ExtracurricularExpected
  wide?: boolean
}) {
  const delivered = therapy.scheduled > 0 ? Math.round((therapy.actual / therapy.scheduled) * 100) : null
  const margin = therapy.actual > 0 ? Math.round((therapy.income / therapy.actual) * 100) : null

  const lines: Line[] = [
    {
      label: 'Therapy',
      scheduled: formatRupiah(therapy.scheduled),
      actual: formatRupiah(therapy.actual),
      actualNote: delivered !== null ? `${delivered}% of scheduled` : null,
      income: formatRupiah(therapy.income),
      incomeNote: `after ${formatRupiah(therapy.actualCommission)} commission${margin !== null ? ` · ${margin}% of actual` : ''}`,
    },
    { label: 'Montessori school', scheduled: null, actual: null, actualNote: null, income: null, incomeNote: null },
    { label: 'Extracurricular', scheduled: formatRupiah(extra.amount), actual: null, actualNote: null, income: null, incomeNote: null },
  ]

  const Dash = () => <span className="text-gray-400">—</span>

  return (
    <Box title={`Billing · ${monthLabel}`} href="/admin/billing" linkLabel="Billing" wide={wide}>
      {/* Wide screens: one row per line of business */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <th className="pb-1.5 pr-2 font-semibold"></th>
              <th className="pb-1.5 pr-2 text-right font-semibold">Scheduled</th>
              <th className="pb-1.5 pr-2 text-right font-semibold">Actual</th>
              <th className="pb-1.5 text-right font-semibold">Therapy income</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 tabular-nums">
            {lines.map((l) => (
              <tr key={l.label}>
                <td className="py-2 pr-2 font-medium text-gray-700">{l.label}</td>
                <td className="py-2 pr-2 text-right font-semibold text-gray-900">{l.scheduled ?? <Dash />}</td>
                <td className="py-2 pr-2 text-right font-semibold text-gray-900">
                  {l.actual ?? <Dash />}
                  {l.actualNote && <span className="block text-[11px] font-normal text-gray-400">{l.actualNote}</span>}
                </td>
                <td className="py-2 text-right font-semibold" style={{ color: '#059669' }}>
                  {l.income ?? <span className="text-gray-400">—</span>}
                  {l.incomeNote && <span className="block text-[11px] font-normal text-gray-400">{l.incomeNote}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: the same numbers, one line of business at a time */}
      <div className="flex flex-col divide-y divide-gray-100 tabular-nums sm:hidden">
        {lines.map((l) => (
          <div key={l.label} className="flex flex-col gap-1 py-2.5">
            <p className="text-sm font-medium text-gray-700">{l.label}</p>
            {([
              ['Scheduled', l.scheduled, null, '#111827'],
              ['Actual', l.actual, l.actualNote, '#111827'],
              ['Therapy income', l.income, l.incomeNote, '#059669'],
            ] as const).map(([name, value, note, color]) =>
              value === null ? null : (
                <div key={name} className="flex items-start justify-between gap-3">
                  <span className="text-xs text-gray-500">{name}</span>
                  <span className="text-right">
                    <span className="text-sm font-semibold" style={{ color }}>
                      {value}
                    </span>
                    {note && <span className="block text-[11px] text-gray-400">{note}</span>}
                  </span>
                </div>
              )
            )}
            {l.scheduled === null && l.actual === null && l.income === null && <p className="text-xs text-gray-400">Not tracked yet</p>}
          </div>
        ))}
      </div>

      <Hint>
        Therapy: the {therapy.sessions} sessions on the calendar this month at the billing rates, and the {therapy.delivered} already delivered
        {therapy.unrated > 0 ? `. ${therapy.unrated} have no rate set and are left out` : ''}. Therapy income is what the delivered sessions bill
        minus the teacher commission on them. Extracurricular: {extra.signups} sign-ups of enrolled children at the activity prices
        {extra.unpriced > 0 ? ` (${extra.unpriced} activities have no price)` : ''}. School fees and extracurricular payments are not tracked yet, so
        those cells stay empty.
      </Hint>
    </Box>
  )
}
