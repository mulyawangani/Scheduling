'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateHomework } from './actions'

export interface RecentNoteRow {
  id: string
  studentName: string
  protocolName: string
  whenLabel: string
  reviewLabel: string | null
  parentInstructions: string | null
  status: 'submitted' | 'sent_back' | 'accepted'
  ownerComment: string | null
}

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'

const STATUS_BADGE: Record<RecentNoteRow['status'], { label: string; className: string }> = {
  submitted: { label: 'Awaiting review', className: 'bg-gray-100 text-gray-600' },
  sent_back: { label: 'Sent back', className: 'bg-amber-100 text-amber-800' },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-800' },
}

export function RecentNotesList({ notes }: { notes: RecentNoteRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function startEdit(note: RecentNoteRow) {
    setError(null)
    setDraft(note.parentInstructions ?? '')
    setEditingId(note.id)
  }

  function handleSave(noteId: string) {
    setError(null)
    startTransition(async () => {
      const result = await updateHomework(noteId, draft)
      if (result.error) {
        setError(result.error)
        return
      }
      setEditingId(null)
      router.refresh()
    })
  }

  return (
    <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
      {notes.map((n) => {
        const isEditing = editingId === n.id
        const badge = STATUS_BADGE[n.status]
        return (
          <li key={n.id} className="p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>
                {n.studentName} — {n.protocolName}
                <span className="text-gray-400"> · {n.whenLabel}</span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {n.reviewLabel && <span className="text-xs text-gray-400">{n.reviewLabel}</span>}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
              </div>
            </div>

            {n.status === 'sent_back' && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-700">Owner&apos;s comment</p>
                <p className="text-xs text-amber-900">{n.ownerComment}</p>
                <Link href={`/teacher/therapy-notes/edit/${n.id}`} className="mt-1 inline-block text-xs font-medium text-blue-600 hover:underline">
                  Edit &amp; resubmit
                </Link>
              </div>
            )}

            {!isEditing ? (
              <div className="mt-1 flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-xs text-gray-500">
                  {n.parentInstructions ? (
                    <>
                      <span className="font-medium text-blue-700">Homework: </span>
                      {n.parentInstructions}
                    </>
                  ) : (
                    'No homework set for this note.'
                  )}
                </p>
                <button onClick={() => startEdit(n)} className="shrink-0 text-xs text-blue-600 hover:underline">
                  {n.parentInstructions ? 'Edit homework' : '+ Add homework'}
                </button>
              </div>
            ) : (
              <div className="mt-2">
                {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className={inputClass} />
                <div className="mt-1 flex gap-3">
                  <button
                    onClick={() => handleSave(n.id)}
                    disabled={isPending}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} disabled={isPending} className="text-xs text-gray-500 hover:underline">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
