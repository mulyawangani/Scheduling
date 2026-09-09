'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptNote, sendNoteBack } from './actions'

export interface NoteRow {
  id: string
  dateLabel: string
  studentName: string
  teacherName: string
  protocolName: string
  reviewLabel: string | null
  repatterningNotes: string | null
  activeNotes: string | null
  objectives: { objective: string; outcome: string }[]
  observations: string | null
  parentInstructions: string | null
  status: 'submitted' | 'sent_back' | 'accepted'
  ownerComment: string | null
}

const STATUS_BADGE: Record<NoteRow['status'], { label: string; className: string }> = {
  submitted: { label: 'Awaiting review', className: 'bg-gray-100 text-gray-600' },
  sent_back: { label: 'Sent back', className: 'bg-amber-100 text-amber-800' },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-800' },
}

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'

function NoteReviewRow({ note }: { note: NoteRow }) {
  const [sendingBack, setSendingBack] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const badge = STATUS_BADGE[note.status]
  // A resubmitted note keeps status 'submitted' but still carries the prior
  // owner_comment (cleared only on accept) — that combination is the signal
  // this is a second look, not a first one.
  const isResubmission = note.status === 'submitted' && !!note.ownerComment

  function handleAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptNote(note.id)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  function handleSendBack() {
    setError(null)
    startTransition(async () => {
      const result = await sendNoteBack(note.id, comment)
      if (result.error) {
        setError(result.error)
        return
      }
      setSendingBack(false)
      setComment('')
      router.refresh()
    })
  }

  return (
    <li className="p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">
          {note.studentName} — {note.protocolName}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-gray-400">
            {note.dateLabel}
            {note.reviewLabel ? ` · ${note.reviewLabel}` : ''}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
        </div>
      </div>
      <p className="mt-0.5 text-xs text-gray-500">{note.teacherName}</p>

      {isResubmission && (
        <p className="mt-1 text-xs text-amber-700">Resubmitted — was sent back for: {note.ownerComment}</p>
      )}
      {note.status === 'sent_back' && <p className="mt-1 text-xs text-amber-700">Sent back for: {note.ownerComment}</p>}

      {note.repatterningNotes && (
        <p className="mt-1 text-xs text-gray-600">
          <span className="font-medium">Repatterning: </span>
          {note.repatterningNotes}
        </p>
      )}
      {note.activeNotes && (
        <p className="mt-1 text-xs text-gray-600">
          <span className="font-medium">Active: </span>
          {note.activeNotes}
        </p>
      )}
      {note.objectives.length > 0 && (
        <ul className="mt-1 text-xs text-gray-600">
          {note.objectives.map((o, i) => (
            <li key={i}>
              <span className="font-medium">{o.objective}</span>
              {o.outcome && <span> — {o.outcome}</span>}
            </li>
          ))}
        </ul>
      )}
      {note.observations && <p className="mt-1 text-xs text-gray-600">{note.observations}</p>}
      {note.parentInstructions && (
        <p className="mt-1 text-xs text-blue-700">
          <span className="font-medium">Homework: </span>
          {note.parentInstructions}
        </p>
      )}

      {note.status !== 'accepted' && (
        <div className="mt-2">
          {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
          {!sendingBack ? (
            <div className="flex gap-3">
              <button
                onClick={handleAccept}
                disabled={isPending}
                className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Accept
              </button>
              <button onClick={() => setSendingBack(true)} disabled={isPending} className="text-xs text-amber-700 hover:underline">
                Send back with a comment
              </button>
            </div>
          ) : (
            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="What needs to change?"
                className={inputClass}
              />
              <div className="mt-1 flex gap-3">
                <button
                  onClick={handleSendBack}
                  disabled={isPending || !comment.trim()}
                  className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {isPending ? 'Sending…' : 'Send back'}
                </button>
                <button
                  onClick={() => {
                    setSendingBack(false)
                    setComment('')
                  }}
                  disabled={isPending}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

export function NotesList({ notes }: { notes: NoteRow[] }) {
  const [teacherFilter, setTeacherFilter] = useState('')
  const [studentFilter, setStudentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const teacherNames = Array.from(new Set(notes.map((n) => n.teacherName))).sort()
  const studentNames = Array.from(new Set(notes.map((n) => n.studentName))).sort()

  const filtered = notes.filter((n) => {
    if (teacherFilter && n.teacherName !== teacherFilter) return false
    if (studentFilter && n.studentName !== studentFilter) return false
    if (statusFilter && n.status !== statusFilter) return false
    return true
  })
  const isFiltered = teacherFilter !== '' || studentFilter !== '' || statusFilter !== ''

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">All statuses</option>
          <option value="submitted">Awaiting review</option>
          <option value="sent_back">Sent back</option>
          <option value="accepted">Accepted</option>
        </select>
        <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">All teachers</option>
          {teacherNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">All children</option>
          {studentNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {isFiltered && (
          <button
            onClick={() => {
              setTeacherFilter('')
              setStudentFilter('')
              setStatusFilter('')
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
        {isFiltered && (
          <span className="text-xs text-gray-400">
            {filtered.length} of {notes.length}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No notes match these filters.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {filtered.map((n) => (
            <NoteReviewRow key={n.id} note={n} />
          ))}
        </ul>
      )}
    </div>
  )
}
