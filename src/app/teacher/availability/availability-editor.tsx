'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TeacherAvailability } from '@/lib/supabase/types'
import { addTeacherAvailability, removeTeacherAvailability } from './actions'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function AvailabilityEditor({ availability }: { availability: TeacherAvailability[] }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleAdd(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await addTeacherAvailability(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      await removeTeacherAvailability(id)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {availability.length === 0 ? (
        <p className="text-sm text-gray-500">No availability windows yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {availability.map((a) => (
            <li key={a.id} className="flex items-center justify-between p-3 text-sm">
              <span>
                {DAYS[a.day_of_week]} {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
              </span>
              <button
                onClick={() => handleRemove(a.id)}
                disabled={isPending}
                className="text-red-600 hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form action={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <select name="day" defaultValue="" className="rounded-lg border border-gray-300 px-3 py-2">
          <option value="">Day</option>
          {DAYS.map((day, i) => (
            <option key={day} value={i}>
              {day}
            </option>
          ))}
        </select>
        <input type="time" name="startTime" className="rounded-lg border border-gray-300 px-3 py-2" />
        <input type="time" name="endTime" className="rounded-lg border border-gray-300 px-3 py-2" />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add window
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
