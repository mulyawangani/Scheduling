'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateHomework } from './actions'

export interface RecentNoteRow {
  id: string
  studentName: string
  protocolName: string
  whenLabel: string
  reviewLabel: string | null
  parentInstructions: string | null
}

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'

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
        return (
          <li key={n.id} className="p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>
                {n.studentName} — {n.protocolName}
                <span className="text-gray-400"> · {n.whenLabel}</span>
              </span>
              {n.reviewLabel && <span className="shrink-0 text-xs text-gray-400">{n.reviewLabel}</span>}
            </div>

            {!isEditing ? (
              <div className="mt-1 flex items-start justify-between gap-3">
                <p className="text-xs text-gray-500">
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
