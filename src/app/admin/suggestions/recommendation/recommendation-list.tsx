'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { UnmetNeed } from '@/lib/matching/unmet-needs'
import { PRIORITY_LABEL } from '@/lib/priority'
import { deleteNeeds } from '../actions'
import { prioritizeNeed, unprioritizeNeed } from './actions'

export interface RankedNeed {
  need: UnmetNeed
  priority: number
  rate: number
  /** Set when this need is unmet because its last session was cancelled — same teacher, so the owner can rebook her on a different day. */
  previousTeacher: { teacherName: string; cancelledAt: string | null } | null
  bestCandidate: { teacherName: string; coverageCount: number; totalNeeded: number; rating: number } | null
}

function candidateLabel(item: RankedNeed): string {
  if (!item.bestCandidate) return 'No qualified teacher assigned to this protocol at all yet.'
  const { teacherName, coverageCount, totalNeeded, rating } = item.bestCandidate
  const ratingLabel = `${rating.toFixed(1)}★`
  if (totalNeeded > 1) {
    const full = coverageCount >= totalNeeded
    return `Best available: ${teacherName} — covers ${coverageCount}/${totalNeeded} sub-protocols, avg ${ratingLabel}${full ? '' : ' (partial — a stretch match)'}`
  }
  return `Best available: ${teacherName} — ${ratingLabel}`
}

export function RecommendationList({ items, showRank = true }: { items: RankedNeed[]; showRank?: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [protocolFilter, setProtocolFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [studentSearch, setStudentSearch] = useState('')

  const protocolNames = Array.from(new Set(items.map((item) => item.need.protocolName))).sort()
  const teacherNames = Array.from(
    new Set(items.map((item) => item.bestCandidate?.teacherName).filter((n): n is string => !!n))
  ).sort()

  const filteredItems = items.filter((item) => {
    if (protocolFilter && item.need.protocolName !== protocolFilter) return false
    if (teacherFilter && item.bestCandidate?.teacherName !== teacherFilter) return false
    if (studentSearch && !item.need.studentName.toLowerCase().includes(studentSearch.trim().toLowerCase())) return false
    return true
  })
  const isFiltered = protocolFilter !== '' || teacherFilter !== '' || studentSearch.trim() !== ''

  function handleClear(item: RankedNeed) {
    const need = item.need
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

  function handleTogglePrioritize(item: RankedNeed) {
    const need = item.need
    setError(null)
    startTransition(async () => {
      const result = need.prioritized
        ? await unprioritizeNeed(need.studentId, need.protocolId)
        : await prioritizeNeed(need.studentId, need.protocolId)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={protocolFilter}
            onChange={(e) => setProtocolFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">All protocols</option>
            {protocolNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">All best-match teachers</option>
            {teacherNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            placeholder="Search child…"
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
          {isFiltered && (
            <button
              onClick={() => {
                setProtocolFilter('')
                setTeacherFilter('')
                setStudentSearch('')
              }}
              className="text-sm text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
          {isFiltered && (
            <span className="text-xs text-gray-400">
              {filteredItems.length} of {items.length}
            </span>
          )}
        </div>
      )}
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {isFiltered && filteredItems.length === 0 ? (
        <p className="text-sm text-gray-500">No needs match these filters.</p>
      ) : (
      <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
        {filteredItems.map((item) => {
          const need = item.need
          const i = items.indexOf(item)
          return (
            <li
              key={`${need.studentId}:${need.protocolId}`}
              className={`flex items-start justify-between gap-3 p-3 ${need.prioritized ? 'bg-blue-50' : ''}`}
            >
              <div className="flex gap-3">
                {showRank && <span className="mt-0.5 w-6 shrink-0 text-sm font-semibold text-gray-400">{i + 1}</span>}
                <div>
                  <p className="font-medium">
                    {need.prioritized && <span className="mr-1 text-blue-600">★</span>}
                    {need.studentName} — {need.protocolName}
                  </p>
                  {need.subProtocols.length > 0 && (
                    <p className="text-xs text-gray-500">{need.subProtocols.map((sp) => sp.name).join(', ')}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    Priority {item.priority ? (PRIORITY_LABEL[item.priority] ?? item.priority) : '—'} · Rate {item.rate ? `$${item.rate}` : '—'}
                  </p>
                  {item.previousTeacher && (
                    <p className="mt-1 text-xs font-medium text-purple-700">
                      🔁 Cancelled{item.previousTeacher.cancelledAt ? ` ${item.previousTeacher.cancelledAt}` : ''} — try{' '}
                      {item.previousTeacher.teacherName} again on a different day
                    </p>
                  )}
                  <p className="mt-1 text-xs text-amber-700">{candidateLabel(item)}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/suggestions/${need.studentId}/${need.protocolId}`}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Assign
                  </Link>
                  <button
                    onClick={() => handleClear(item)}
                    disabled={isPending}
                    className="text-sm text-red-600 hover:underline disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
                <button
                  onClick={() => handleTogglePrioritize(item)}
                  disabled={isPending}
                  className={`text-xs hover:underline disabled:opacity-50 ${need.prioritized ? 'text-gray-500' : 'text-blue-600'}`}
                >
                  {need.prioritized ? 'Un-prioritize' : 'Prioritize for next week'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      )}
    </div>
  )
}
