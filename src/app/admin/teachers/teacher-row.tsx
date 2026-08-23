'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ServesScope, TeacherStatus } from '@/lib/supabase/types'
import { updateTeacherProfile, deleteTeacher } from './actions'

const STATUS_LABEL: Record<TeacherStatus, string> = { teacher: 'Teacher', therapist: 'Therapist' }
const SCOPE_LABEL: Record<ServesScope, string> = {
  student_only: 'Students only',
  non_student_only: 'Non-students only',
  both: 'Both',
}

export function TeacherRow({
  id,
  name,
  email,
  status,
  servesScope,
}: {
  id: string
  name: string
  email: string | null
  status: TeacherStatus | null
  servesScope: ServesScope | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [nameInput, setNameInput] = useState(name)
  const [statusInput, setStatusInput] = useState<TeacherStatus>(status ?? 'teacher')
  const [servesScopeInput, setServesScopeInput] = useState<ServesScope | ''>(servesScope ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateTeacherProfile(id, nameInput, statusInput, servesScopeInput)
      if (result.error) {
        setError(result.error)
        return
      }
      setIsEditing(false)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm(`Delete ${name}? This also removes her availability, protocol assignments, and sessions.`)) return
    setError(null)
    startTransition(async () => {
      const result = await deleteTeacher(id)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  if (isEditing) {
    return (
      <li className="flex flex-col gap-2 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
          <select
            value={statusInput}
            onChange={(e) => setStatusInput(e.target.value as TeacherStatus)}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="teacher">Teacher</option>
            <option value="therapist">Therapist</option>
          </select>
          <select
            value={servesScopeInput}
            onChange={(e) => setServesScopeInput(e.target.value as ServesScope | '')}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">Auto (by status)</option>
            <option value="student_only">Students only</option>
            <option value="non_student_only">Non-students only</option>
            <option value="both">Both</option>
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
                setStatusInput(status ?? 'teacher')
                setServesScopeInput(servesScope ?? '')
                setError(null)
              }}
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between gap-3 p-3">
      <div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/teachers/${id}`} className="font-medium hover:underline">
            {name}
          </Link>
          {status && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{STATUS_LABEL[status]}</span>
          )}
          {servesScope && (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">{SCOPE_LABEL[servesScope]}</span>
          )}
        </div>
        <p className="text-sm text-gray-500">{email}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-3 text-sm">
        <button onClick={() => setIsEditing(true)} disabled={isPending} className="text-blue-600 hover:underline disabled:opacity-50">
          Edit
        </button>
        <button onClick={handleDelete} disabled={isPending} className="text-red-600 hover:underline disabled:opacity-50">
          Delete
        </button>
      </div>
    </li>
  )
}
