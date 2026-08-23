'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { UnmetNeed } from '@/lib/matching/unmet-needs'
import type { ProposedSession } from '@/lib/matching/generate-schedule'
import { deleteNeeds } from './actions'

const tierLabels: Record<number, string> = { 0: 'Standard', 1: 'Priority', 2: 'VIP' }
const DAY_NAMES: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' }

export function UnassignedList({
  needs,
  recommendedByNeed,
}: {
  needs: UnmetNeed[]
  /** Keyed by `${studentId}:${protocolId}` — the same availability-aware placement the grid above computed, if any. */
  recommendedByNeed?: Record<string, ProposedSession>
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClear(need: UnmetNeed) {
    const label =
      need.subProtocols.length > 0
        ? `${need.protocolName} (${need.subProtocols.length} sub-protocol${need.subProtocols.length === 1 ? '' : 's'})`
        : need.protocolName
    if (!confirm(`Remove "${label}" from ${need.studentName}'s needs? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      const result = await deleteNeeds(need.needIds)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
        {needs.map((need) => {
          const rec = recommendedByNeed?.[`${need.studentId}:${need.protocolId}`]
          return (
          <li key={`${need.studentId}:${need.protocolId}`} className="flex items-center justify-between gap-3 p-3">
            <div>
              <p className="font-medium">
                {need.studentName} — {need.protocolName}
              </p>
              {need.subProtocols.length > 0 && (
                <p className="text-xs text-gray-500">{need.subProtocols.map((sp) => sp.name).join(', ')}</p>
              )}
              <p className="text-xs uppercase text-gray-400">
                {tierLabels[need.parentPriorityTier] ?? need.parentPriorityTier}
              </p>
              {rec ? (
                <p className="mt-1 text-xs text-green-700">
                  Recommended: {rec.teacherName} — {DAY_NAMES[rec.dayOfWeek]} {rec.startTime.slice(0, 5)}–{rec.endTime.slice(0, 5)}
                </p>
              ) : (
                recommendedByNeed && <p className="mt-1 text-xs text-amber-700">No available slot found this week</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/admin/suggestions/${need.studentId}/${need.protocolId}`}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Assign
              </Link>
              <button
                onClick={() => handleClear(need)}
                disabled={isPending}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </li>
          )
        })}
      </ul>
    </div>
  )
}
