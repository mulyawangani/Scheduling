'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { prioritizeNeed, unprioritizeNeed } from '../recommendation/actions'

export interface MissingProtocol {
  protocolId: string
  title: string
  prioritized: boolean
}

export function MissingProtocols({ studentId, missing }: { studentId: string; missing: MissingProtocol[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle(protocolId: string, prioritized: boolean) {
    setPendingId(protocolId)
    startTransition(async () => {
      await (prioritized ? unprioritizeNeed(studentId, protocolId) : prioritizeNeed(studentId, protocolId))
      setPendingId(null)
      router.refresh()
    })
  }

  return (
    <ul className="flex flex-col gap-1">
      {missing.map((m) => (
        <li key={m.protocolId} className="flex items-center gap-2">
          <span className={m.prioritized ? 'text-blue-700' : 'text-red-600'}>
            {m.prioritized && <span className="mr-1 text-amber-500">★</span>}
            {m.title}
          </span>
          <button
            onClick={() => handleToggle(m.protocolId, m.prioritized)}
            disabled={isPending && pendingId === m.protocolId}
            className="text-xs text-gray-500 hover:underline disabled:opacity-50"
          >
            {m.prioritized ? 'Un-prioritize' : 'Prioritize'}
          </button>
        </li>
      ))}
    </ul>
  )
}
