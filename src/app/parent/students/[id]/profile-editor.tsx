'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentStatus } from '@/lib/supabase/types'
import { updateStudentProfile, deleteStudent } from './actions'

export function ProfileEditor({
  studentId,
  name,
  status,
}: {
  studentId: string
  name: string
  status: StudentStatus | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [nameInput, setNameInput] = useState(name)
  const [statusInput, setStatusInput] = useState<StudentStatus | ''>(status ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateStudentProfile(studentId, nameInput, statusInput)
      if (result.error) {
        setError(result.error)
        return
      }
      setIsEditing(false)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm(`Delete ${name}? This also removes their protocol needs, availability, and scheduled sessions. This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      const result = await deleteStudent(studentId)
      if (result?.error) setError(result.error)
    })
  }

  if (!isEditing) {
    return (
      <div className="mb-6 flex items-center gap-3 text-sm">
        <button onClick={() => setIsEditing(true)} className="text-blue-600 hover:underline">
          Edit profile
        </button>
        <button onClick={handleDelete} disabled={isPending} className="text-red-600 hover:underline disabled:opacity-50">
          Delete child
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="mb-6 flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
        />
        <select
          value={statusInput}
          onChange={(e) => setStatusInput(e.target.value as StudentStatus | '')}
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">No status</option>
          <option value="student">Student</option>
          <option value="non_student">Non-student</option>
        </select>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => {
              setIsEditing(false)
              setNameInput(name)
              setStatusInput(status ?? '')
              setError(null)
            }}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Setting status to Student resets availability to school hours (Mon–Fri 08:00–12:00); Non-student keeps your custom timetable below.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
