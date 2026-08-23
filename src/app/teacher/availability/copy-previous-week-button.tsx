'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { copyPreviousWeek } from './actions'

export function CopyPreviousWeekButton({ weekStartDate }: { weekStartDate: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await copyPreviousWeek(weekStartDate)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {isPending ? 'Copying…' : 'Copy previous week'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
