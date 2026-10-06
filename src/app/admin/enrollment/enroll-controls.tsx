'use client'

import { useState, useTransition } from 'react'
import { addEnrollment, cancelEnrollment } from './actions'

export function EnrollPicker({
  month,
  monthLabel,
  candidates,
  loadError,
}: {
  month: string
  monthLabel: string
  candidates: { id: string; name: string }[]
  loadError?: string
}) {
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function enroll() {
    if (!studentId) return
    setError(null)
    startTransition(async () => {
      const result = await addEnrollment(studentId, month)
      if (result.error) {
        setError(result.error)
        return
      }
      setStudentId('')
    })
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Enroll a child for {monthLabel}</h2>
        {loadError ? (
          <span className="text-xs text-red-500">Couldn&apos;t load the list of children: {loadError}</span>
        ) : candidates.length === 0 ? (
          <span className="text-xs text-gray-400">Every child with status Student is already enrolled.</span>
        ) : (
          <>
            <select
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              aria-label="Child to enroll"
              className="min-w-[180px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
            >
              <option value="">Choose a child…</option>
              {candidates.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={enroll}
              disabled={!studentId || pending}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #F59030, #DC2870)' }}
            >
              {pending ? 'Enrolling…' : 'Enroll'}
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function UnenrollButton({
  studentId,
  name,
  month,
  monthLabel,
}: {
  studentId: string
  name: string
  month: string
  monthLabel: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function unenroll() {
    if (!window.confirm(`Remove ${name} from ${monthLabel}? You can enroll them again afterwards.`)) return
    setError(null)
    startTransition(async () => {
      const result = await cancelEnrollment(studentId, month)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="flex-shrink-0 text-right">
      <button
        onClick={unenroll}
        disabled={pending}
        title={`Remove from ${monthLabel}`}
        className="text-[11px] text-gray-300 hover:text-red-500 disabled:opacity-50"
      >
        {pending ? '…' : 'Unenroll'}
      </button>
      {error && <p className="max-w-[140px] text-[10px] text-red-500">{error}</p>}
    </div>
  )
}
