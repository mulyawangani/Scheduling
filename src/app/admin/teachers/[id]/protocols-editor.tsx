'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Protocol, SubProtocol } from '@/lib/supabase/types'
import { assignProtocol, updateProtocolRating, unassignProtocol } from './actions'

export interface AssignedProtocol {
  assignmentId: string
  protocolTitle: string
  subProtocolTitle: string | null
  rating: number
}

export function ProtocolsEditor({
  teacherId,
  allProtocols,
  subProtocolsByProtocol,
  assignedProtocols,
}: {
  teacherId: string
  allProtocols: Protocol[]
  subProtocolsByProtocol: Record<string, SubProtocol[]>
  assignedProtocols: AssignedProtocol[]
}) {
  const [assignProtocolId, setAssignProtocolId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const subProtocolOptions = useMemo(
    () =>
      (subProtocolsByProtocol[assignProtocolId] ?? [])
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title)),
    [subProtocolsByProtocol, assignProtocolId]
  )

  function handleAssign(formData: FormData) {
    setError(null)
    const protocolId = String(formData.get('protocolId') || '')
    const subProtocolId = String(formData.get('subProtocolId') || '') || null
    const rating = Number(formData.get('rating') || '')
    if (!protocolId || !rating) {
      setError('Choose a protocol and a rating to assign.')
      return
    }
    startTransition(async () => {
      const result = await assignProtocol(teacherId, protocolId, subProtocolId, rating)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  function handleRatingChange(assignmentId: string, rating: number) {
    startTransition(async () => {
      await updateProtocolRating(teacherId, assignmentId, rating)
      router.refresh()
    })
  }

  function handleUnassign(assignmentId: string) {
    startTransition(async () => {
      await unassignProtocol(teacherId, assignmentId)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {assignedProtocols.length === 0 ? (
        <p className="text-sm text-gray-500">No protocols assigned yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {assignedProtocols.map((p) => (
            <li key={p.assignmentId} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>
                {p.subProtocolTitle ? `${p.subProtocolTitle} ` : ''}
                <span className="text-gray-500">({p.protocolTitle})</span>
              </span>
              <div className="flex items-center gap-2">
                <select
                  defaultValue={p.rating}
                  disabled={isPending}
                  onChange={(e) => handleRatingChange(p.assignmentId, Number(e.target.value))}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleUnassign(p.assignmentId)}
                  disabled={isPending}
                  className="text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="mb-1 text-xs font-medium text-gray-500">
          Assign a protocol (and sub-protocol if applicable) and rate her on it (1-5)
        </p>
        <form action={handleAssign} className="flex flex-col gap-2 sm:flex-row">
          <select
            name="protocolId"
            value={assignProtocolId}
            onChange={(e) => setAssignProtocolId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Protocol</option>
            {allProtocols
              .slice()
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </select>
          <select name="subProtocolId" disabled={!assignProtocolId} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">— protocol-level —</option>
            {subProtocolOptions.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.title}
              </option>
            ))}
          </select>
          <select name="rating" defaultValue="" className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Rating</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending || !assignProtocolId}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Assign
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
