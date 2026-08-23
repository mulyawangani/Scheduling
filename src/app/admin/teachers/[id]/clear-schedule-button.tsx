'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { clearTeacherSchedule } from './actions'

export function ClearScheduleButton({ teacherId, teacherName, sessionCount }: { teacherId: string; teacherName: string; sessionCount: number }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (sessionCount === 0) return null

  function handleClear() {
    if (!confirm(`Cancel all ${sessionCount} active session(s) for ${teacherName}? This resets her whole schedule.`)) return
    setError(null)
    startTransition(async () => {
      const result = await clearTeacherSchedule(teacherId)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClear}
        disabled={isPending}
        className="self-start rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? 'Clearing…' : `Clear schedule (${sessionCount})`}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
