'use client'

import { useTransition } from 'react'
import { markAsPaid, markAsUnpaid, markAsPending } from './actions'

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  paid:    { bg: '#DCFCE7', text: '#16A34A', label: 'Paid' },
  pending: { bg: '#FEF9C3', text: '#CA8A04', label: 'Pending' },
  unpaid:  { bg: '#FEE2E2', text: '#DC2626', label: 'Unpaid' },
  failed:  { bg: '#F3F4F6', text: '#9CA3AF', label: 'Failed' },
  refunded:{ bg: '#EDE9FE', text: '#7C3AED', label: 'Refunded' },
}

const NEXT_STATUS: Record<string, 'paid' | 'pending' | 'unpaid'> = {
  unpaid:  'pending',
  pending: 'paid',
  paid:    'unpaid',
  failed:  'unpaid',
  refunded:'unpaid',
}

export function PaymentStatusButton({
  studentId,
  month,
  status,
  xenditPaymentId,
}: {
  studentId: string
  month: string
  status: string
  xenditPaymentId: string | null
}) {
  const [pending, startTransition] = useTransition()
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.unpaid
  const next = NEXT_STATUS[status] ?? 'unpaid'

  function toggle() {
    startTransition(async () => {
      if (next === 'paid') await markAsPaid(studentId, month)
      else if (next === 'pending') await markAsPending(studentId, month)
      else await markAsUnpaid(studentId, month)
    })
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={toggle}
        disabled={pending}
        className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-50"
        style={{ background: style.bg, color: style.text }}
        title={`Click to mark as ${next}`}
      >
        {pending ? '...' : style.label}
      </button>
      {xenditPaymentId && (
        <span className="text-[9px] text-gray-400 font-mono">{xenditPaymentId}</span>
      )}
    </div>
  )
}
