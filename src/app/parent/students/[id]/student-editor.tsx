'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Subject, StudentAvailability } from '@/lib/supabase/types'
import { toggleSubject, addAvailability, removeAvailability } from './actions'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function StudentEditor({
  studentId,
  subjects,
  selectedSubjectIds,
  availability,
}: {
  studentId: string
  subjects: Subject[]
  selectedSubjectIds: string[]
  availability: StudentAvailability[]
}) {
  const [selected, setSelected] = useState(new Set(selectedSubjectIds))
  const [availError, setAvailError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubjectToggle(subjectId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(subjectId)
      } else {
        next.delete(subjectId)
      }
      return next
    })
    startTransition(async () => {
      await toggleSubject(studentId, subjectId, checked)
      router.refresh()
    })
  }

  function handleAddAvailability(formData: FormData) {
    setAvailError(null)
    startTransition(async () => {
      const result = await addAvailability(studentId, formData)
      if (result.error) {
        setAvailError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleRemoveAvailability(id: string) {
    startTransition(async () => {
      await removeAvailability(studentId, id)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Subjects needed</h2>
        <div className="flex flex-col gap-2">
          {subjects.map((subject) => (
            <label key={subject.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(subject.id)}
                onChange={(e) => handleSubjectToggle(subject.id, e.target.checked)}
              />
              {subject.name}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Availability</h2>
        {availability.length === 0 ? (
          <p className="mb-3 text-sm text-gray-500">No availability windows yet.</p>
        ) : (
          <ul className="mb-3 flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
            {availability.map((a) => (
              <li key={a.id} className="flex items-center justify-between p-3 text-sm">
                <span>
                  {DAYS[a.day_of_week]} {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
                </span>
                <button
                  onClick={() => handleRemoveAvailability(a.id)}
                  disabled={isPending}
                  className="text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <form action={handleAddAvailability} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
        {availError && <p className="mt-2 text-sm text-red-600">{availError}</p>}
      </section>
    </div>
  )
}
