'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resetAllSchedules } from './actions'

export function ResetAllButton({ activeSessionCount, prioritizedCount }: { activeSessionCount: number; prioritizedCount: number }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (activeSessionCount === 0 && prioritizedCount === 0) return null

  function handleReset() {
    const parts = [`${activeSessionCount} active session(s)`]
    if (prioritizedCount > 0) parts.push(`${prioritizedCount} starred/prioritized need(s)`)
    if (!confirm(`Cancel ${parts.join(' and ')} across every teacher and student? This resets the whole schedule so you can generate fresh. This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      const result = await resetAllSchedules()
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleReset}
        disabled={isPending}
        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? 'Resetting…' : 'Reset all schedules'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
