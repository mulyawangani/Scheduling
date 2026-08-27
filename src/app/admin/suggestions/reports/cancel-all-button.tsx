'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelMonthlyTransactions } from './actions'

export function CancelAllButton({ sessionIds, monthLabel }: { sessionIds: string[]; monthLabel: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (sessionIds.length === 0) return null

  function handleClick() {
    if (
      !confirm(
        `Cancel all ${sessionIds.length} completed session${sessionIds.length === 1 ? '' : 's'} counted as "done" for ${monthLabel}? They'll go back to unscheduled here — the sessions and their therapy notes stay on record, just marked cancelled.`
      )
    )
      return
    setError(null)
    startTransition(async () => {
      const result = await cancelMonthlyTransactions(sessionIds)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="mb-4">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? 'Cancelling…' : `Cancel all (${sessionIds.length})`}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
