'use client'

import { useState, useTransition } from 'react'
import type { Protocol, SubProtocol } from '@/lib/supabase/types'
import { HourSelect } from '@/components/hour-select'
import { createStudent } from './actions'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function NewStudentForm({
  protocols,
  subProtocolsByProtocol,
}: {
  protocols: Protocol[]
  subProtocolsByProtocol: Record<string, SubProtocol[]>
}) {
  const [error, setError] = useState<string | null>(null)
  const [availMode, setAvailMode] = useState<'day' | 'date'>('day')
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

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-gray-700">Protocols needed</legend>
        {protocols.map((protocol) => {
          const subProtocols = subProtocolsByProtocol[protocol.id] ?? []
          if (subProtocols.length > 0) {
            return (
              <div key={protocol.id}>
                <p className="mb-1 text-xs font-medium text-gray-500">{protocol.title}</p>
                <div className="flex flex-col gap-2 pl-2">
                  {subProtocols.map((sp) => (
                    <label key={sp.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="protocolIds" value={`${protocol.id}:${sp.id}`} />
                      {sp.title}
                    </label>
                  ))}
                </div>
              </div>
            )
          }
          return (
            <label key={protocol.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="protocolIds" value={protocol.id} />
              {protocol.title}
            </label>
          )
        })}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        Status
        <select name="status" defaultValue="" className="rounded-lg border border-gray-300 px-3 py-2">
          <option value="">None</option>
          <option value="student">Student</option>
          <option value="non_student">Non-student</option>
        </select>
        <span className="text-xs text-gray-400">
          Student sets availability to Mon–Fri 08:00–12:00 automatically. Non-student: set availability below.
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">
          Availability (optional — you can add more later)
        </legend>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" checked={availMode === 'day'} onChange={() => setAvailMode('day')} />
            Every week on...
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={availMode === 'date'} onChange={() => setAvailMode('date')} />
            Specific date
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {availMode === 'day' ? (
            <select name="day" defaultValue="" className="rounded-lg border border-gray-300 px-3 py-2">
              <option value="">Day</option>
              {DAYS.map((day, i) => (
                <option key={day} value={i}>
                  {day}
                </option>
              ))}
            </select>
          ) : (
            <input type="date" name="specificDate" className="rounded-lg border border-gray-300 px-3 py-2" />
          )}
          <HourSelect name="startTime" className="rounded-lg border border-gray-300 px-3 py-2" />
          <HourSelect name="endTime" className="rounded-lg border border-gray-300 px-3 py-2" />
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
