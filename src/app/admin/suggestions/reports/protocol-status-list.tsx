'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { prioritizeNeed, unprioritizeNeed } from '../recommendation/actions'

export interface ProtocolStatus {
  protocolId: string
  title: string
  /** done: delivered this month. booked: a pending/accepted one-off session already exists, just not yet completed. unscheduled: nothing booked at all. */
  state: 'done' | 'booked' | 'unscheduled'
  prioritized: boolean
}

export function ProtocolStatusList({ studentId, protocols }: { studentId: string; protocols: ProtocolStatus[] }) {
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
      {protocols.map((p) => {
        if (p.state === 'done') {
          return (
            <li key={p.protocolId} className="flex items-center gap-2">
              <span className="text-green-600">✓ {p.title}</span>
            </li>
          )
        }
        if (p.state === 'booked') {
          return (
            <li key={p.protocolId} className="flex items-center gap-2">
              <span className="text-gray-400">{p.title}</span>
              <span className="text-xs text-gray-400">Already booked, awaiting completion</span>
            </li>
          )
        }
        return (
          <li key={p.protocolId} className="flex items-center gap-2">
            <span className={p.prioritized ? 'text-blue-700' : 'text-red-600'}>
              {p.prioritized && <span className="mr-1 text-amber-500">★</span>}
              {p.title}
            </span>
            <button
              onClick={() => handleToggle(p.protocolId, p.prioritized)}
              disabled={isPending && pendingId === p.protocolId}
              className="text-xs text-gray-500 hover:underline disabled:opacity-50"
            >
              {p.prioritized ? 'Un-prioritize' : 'Prioritize'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
