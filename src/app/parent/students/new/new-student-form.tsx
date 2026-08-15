'use client'

import { useState, useTransition } from 'react'
import type { Subject } from '@/lib/supabase/types'
import { createStudent } from './actions'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function NewStudentForm({ subjects }: { subjects: Subject[] }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createStudent(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <input
        name="name"
        placeholder="Student name"
        required
        className="rounded-lg border border-gray-300 px-3 py-2"
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">Subjects needed</legend>
        {subjects.map((subject) => (
          <label key={subject.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="subjectIds" value={subject.id} />
            {subject.name}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">
          Availability (optional — you can add more later)
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Creating…' : 'Add student'}
      </button>
    </form>
  )
}
