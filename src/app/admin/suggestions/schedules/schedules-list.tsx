'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ScheduleBatch } from '@/lib/supabase/types'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'
import { formatWeekLabel } from '@/lib/week'
import { pushWhatsAppForBatch, deleteScheduleBatch, cancelScheduleBatch } from './actions'
import { ActualSessionsGrid, type GridSession } from './actual-sessions-grid'

export interface ScheduleBatchWithSessions extends ScheduleBatch {
  sessions: {
    id: string
    studentName: string
    protocolName: string
    teacherName: string
    when: string
    hasPhone: boolean
  }[]
  /** Every real booked session for this batch's week, tagged into this batch or not — see ActualSessionsGrid. */
  actualSessions: GridSession[]
}

const createdAtFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: BUSINESS_TIMEZONE,
})

export function SchedulesList({ batches }: { batches: ScheduleBatchWithSessions[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pushing, setPushing] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<Record<string, { sent: number; noPhone: number; failed: number } | string>>({})
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<Set<string>>(new Set())
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handlePush(batchId: string) {
    if (!confirm('Send the WhatsApp confirmation for every session in this schedule now?')) return
    setPushing((prev) => new Set(prev).add(batchId))
    setResults((prev) => {
      const next = { ...prev }
      delete next[batchId]
      return next
    })
    startTransition(async () => {
      const result = await pushWhatsAppForBatch(batchId)
      setPushing((prev) => {
        const next = new Set(prev)
        next.delete(batchId)
        return next
      })
      if (result.error) {
        setResults((prev) => ({ ...prev, [batchId]: result.error as string }))
        return
      }
      setResults((prev) => ({ ...prev, [batchId]: { sent: result.sent!, noPhone: result.noPhone!, failed: result.failed! } }))
      router.refresh()
    })
  }

  function handleCancelAll(batchId: string, count: number) {
    if (
      !confirm(
        `Cancel all ${count} active session${count === 1 ? '' : 's'} in this schedule? This cancels the real sessions — parents and teachers who were already notified will need to be told separately. This cannot be undone from here.`
      )
    )
      return
    setCancelError(null)
    setCancelling((prev) => new Set(prev).add(batchId))
    startTransition(async () => {
      const result = await cancelScheduleBatch(batchId)
      setCancelling((prev) => {
        const next = new Set(prev)
        next.delete(batchId)
        return next
      })
      if (result.error) {
        setCancelError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleDelete(batchId: string) {
    if (
      !confirm(
        "Delete this schedule? This only removes the grouping — the sessions themselves stay booked and untouched, they'll just no longer show here."
      )
    )
      return
    setDeleteError(null)
    setDeleting((prev) => new Set(prev).add(batchId))
    startTransition(async () => {
      const result = await deleteScheduleBatch(batchId)
      setDeleting((prev) => {
        const next = new Set(prev)
        next.delete(batchId)
        return next
      })
      if (result.error) {
        setDeleteError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
      {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
      <ul className="flex flex-col gap-3">
      {batches.map((batch) => {
        const isExpanded = expanded.has(batch.id)
        const result = results[batch.id]
        return (
          <li key={batch.id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => toggleExpanded(batch.id)} className="text-left">
                <p className="text-sm font-medium">
                  {batch.label} <span className="font-normal text-gray-400">· {batch.sessions.length} sessions</span>
                </p>
                <p className="text-xs text-gray-500">
                  Week of {formatWeekLabel(batch.week_start_date)} · Booked {createdAtFormatter.format(new Date(batch.created_at))}
                  {batch.whatsapp_pushed_at && (
                    <span className="text-green-600"> · WhatsApp pushed {createdAtFormatter.format(new Date(batch.whatsapp_pushed_at))}</span>
                  )}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => handlePush(batch.id)}
                  disabled={isPending || pushing.has(batch.id)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {pushing.has(batch.id) ? 'Pushing…' : 'WhatsApp push'}
                </button>
                {batch.sessions.length > 0 && (
                  <button
                    onClick={() => handleCancelAll(batch.id, batch.sessions.length)}
                    disabled={isPending || cancelling.has(batch.id)}
                    className="text-sm text-red-600 hover:underline disabled:opacity-50"
                  >
                    {cancelling.has(batch.id) ? 'Cancelling…' : 'Cancel all'}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(batch.id)}
                  disabled={isPending || deleting.has(batch.id)}
                  className="text-sm text-gray-500 hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>

            {result && (
              <p className={`mt-2 text-xs ${typeof result === 'string' ? 'text-red-600' : 'text-gray-600'}`}>
                {typeof result === 'string'
                  ? result
                  : `Sent ${result.sent}${result.noPhone > 0 ? ` · ${result.noPhone} no phone on file` : ''}${result.failed > 0 ? ` · ${result.failed} failed to send` : ''}`}
              </p>
            )}

            {isExpanded && (
              <div className="mt-3 border-t border-gray-200 pt-2">
                <p className="mb-1 text-xs font-medium text-gray-500">Sessions tagged into this schedule</p>
                {batch.sessions.length === 0 ? (
                  <p className="mb-3 text-xs text-gray-400">None — see the actual grid below for what&apos;s really booked this week.</p>
                ) : (
                  <ul className="mb-3 flex flex-col divide-y divide-gray-200">
                    {batch.sessions.map((s) => (
                      <li key={s.id} className="flex items-center justify-between py-1.5 text-sm">
                        <span>
                          {s.studentName} — {s.protocolName} with {s.teacherName}
                          <span className="text-gray-400"> · {s.when}</span>
                        </span>
                        {!s.hasPhone && <span className="shrink-0 text-xs text-amber-600">No phone on file</span>}
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mb-1 text-xs font-medium text-gray-500">
                  Actual scheduled sessions ({batch.actualSessions.length}) — week of {formatWeekLabel(batch.week_start_date)}
                </p>
                <ActualSessionsGrid weekStartDate={batch.week_start_date} sessions={batch.actualSessions} />
              </div>
            )}
          </li>
        )
      })}
      </ul>
    </div>
  )
}
