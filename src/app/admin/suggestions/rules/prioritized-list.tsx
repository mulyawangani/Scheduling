'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { unprioritizeNeed } from '../recommendation/actions'

export interface PrioritizedItem {
  studentId: string
  protocolId: string
  studentName: string
  protocolName: string
}

export function PrioritizedList({ items }: { items: PrioritizedItem[] }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleUnprioritize(item: PrioritizedItem) {
    setError(null)
    startTransition(async () => {
      const result = await unprioritizeNeed(item.studentId, item.protocolId)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-medium text-gray-700">Currently prioritized</h2>
      <p className="mb-3 text-sm text-gray-500">
        Flagged from the{' '}
        <Link href="/admin/suggestions/recommendation" className="text-blue-600 hover:underline">
          Recommendation
        </Link>{' '}
        tab — these jump ahead of the matching order below on the next Generate Schedule run, temporarily, until
        they&apos;re booked or un-prioritized.
      </p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">None right now.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {items.map((item) => (
            <li key={`${item.studentId}:${item.protocolId}`} className="flex items-center justify-between gap-3 bg-blue-50 p-3 text-sm">
              <span>
                <span className="mr-1 text-blue-600">★</span>
                {item.studentName} — {item.protocolName}
              </span>
              <button
                onClick={() => handleUnprioritize(item)}
                disabled={isPending}
                className="text-sm text-gray-500 hover:underline disabled:opacity-50"
              >
                Un-prioritize
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
