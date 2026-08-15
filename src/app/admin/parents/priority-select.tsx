'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPriorityTier } from './actions'

export function PrioritySelect({ parentId, tier }: { parentId: string; tier: number }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleChange(value: string) {
    startTransition(async () => {
      await setPriorityTier(parentId, Number(value))
      router.refresh()
    })
  }

  return (
    <select
      defaultValue={tier}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
    >
      <option value={0}>Standard</option>
      <option value={1}>Priority</option>
      <option value={2}>VIP</option>
    </select>
  )
}
