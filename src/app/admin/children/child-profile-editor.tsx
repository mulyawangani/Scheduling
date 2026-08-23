'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentStatus } from '@/lib/supabase/types'
import { updateChildProfile, deleteChild } from './actions'

export function computeAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

export function ChildProfileEditor({
  studentId,
  name,
  dateOfBirth,
  ratePerSession,
  priority,
  status,
  weeklyTargetSessions,
  onSaved,
}: {
  studentId: string
  name: string
  dateOfBirth: string | null
  ratePerSession: number | null
  priority: number | null
  status: StudentStatus | null
  weeklyTargetSessions: number
  onSaved?: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const age = computeAge(dateOfBirth)

  function handleSave(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await updateChildProfile(studentId, formData)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      onSaved?.()
    })
  }

  function handleDelete() {
    if (!confirm(`Delete ${name}? This also removes their protocol needs, availability, and sessions.`)) return
    setError(null)
    startTransition(async () => {
      const result = await deleteChild(studentId)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <form action={handleSave} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-gray-500 sm:col-span-1">
          Name
          <input
            name="name"
            defaultValue={name}
            required
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Date of birth {age !== null && <span className="text-gray-400">(age {age})</span>}
          <input
            type="date"
            name="dateOfBirth"
            defaultValue={dateOfBirth ?? ''}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Status
          <select
            name="status"
            defaultValue={status ?? ''}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">None</option>
            <option value="student">Student</option>
            <option value="non_student">Non-student</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="text-gray-400">
            Student sets availability to Mon–Fri 08:00–12:00 on save. Inactive gets no allocation at all.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Rate per session
          <input
            type="number"
            step="0.01"
            min="0"
            name="ratePerSession"
            defaultValue={ratePerSession ?? ''}
            placeholder="0.00"
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Priority
          <select
            name="priority"
            defaultValue={priority ?? ''}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">None</option>
            <option value="1">High</option>
            <option value="2">Medium</option>
            <option value="3">Low</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Weekly target sessions
          <select
            name="weeklyTargetSessions"
            defaultValue={weeklyTargetSessions}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
          <span className="text-gray-400">Max distinct protocols Generate Schedule books per week.</span>
        </label>
        <div className="flex gap-2 sm:col-span-4">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Save profile
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete child
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
