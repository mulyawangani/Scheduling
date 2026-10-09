'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPriorityTier } from './actions'

export const PRIORITY_LABELS = ['Standard', 'Priority', 'VIP'] as const

export function PrioritySelect({ parentId, tier }: { parentId: string; tier: number }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Bumped when a change is rejected, so the select remounts and shows the saved tier again.
  const [rejected, setRejected] = useState(0)
  const router = useRouter()

  function handleChange(value: string) {
    setError(null)
    startTransition(async () => {
      const result = await setPriorityTier(parentId, Number(value))
      if (result.error) {
        setError(result.error)
        setRejected((n) => n + 1)
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        key={`${tier}-${rejected}`}
        defaultValue={tier}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
      >
        {PRIORITY_LABELS.map((label, value) => (
          <option key={label} value={value}>
            {label}
          </option>
        ))}
      </select>
      {error && <p className="max-w-48 text-right text-xs text-red-600">{error}</p>}
    </div>
  )
}
