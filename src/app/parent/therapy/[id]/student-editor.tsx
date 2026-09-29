'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Protocol, SubProtocol, StudentAvailability } from '@/lib/supabase/types'
import { HourSelect } from '@/components/hour-select'
import { toggleProtocol, addAvailability, removeAvailability } from './actions'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function StudentEditor({
  studentId,
  protocols,
  subProtocolsByProtocol,
  selectedKeys,
  availability,
}: {
  studentId: string
  protocols: Protocol[]
  subProtocolsByProtocol: Record<string, SubProtocol[]>
  selectedKeys: string[]
  availability: StudentAvailability[]
}) {
  const [selected, setSelected] = useState(new Set(selectedKeys))
  const [availError, setAvailError] = useState<string | null>(null)
  const [availMode, setAvailMode] = useState<'day' | 'date'>('day')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleProtocolToggle(protocolId: string, subProtocolId: string | null, checked: boolean) {
    const key = subProtocolId ?? protocolId
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
    startTransition(async () => {
      await toggleProtocol(studentId, protocolId, subProtocolId, checked)
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
        <h2 className="mb-2 text-sm font-medium text-gray-700">Protocols needed</h2>
        <div className="flex flex-col gap-3">
          {protocols.map((protocol) => {
            const subProtocols = subProtocolsByProtocol[protocol.id] ?? []
            if (subProtocols.length > 0) {
              return (
                <div key={protocol.id}>
                  <p className="mb-1 text-xs font-medium text-gray-500">{protocol.title}</p>
                  <div className="flex flex-col gap-2 pl-2">
                    {subProtocols.map((sp) => (
                      <label key={sp.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.has(sp.id)}
                          onChange={(e) => handleProtocolToggle(protocol.id, sp.id, e.target.checked)}
                        />
                        {sp.title}
                      </label>
                    ))}
                  </div>
                </div>
              )
            }
            return (
              <label key={protocol.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(protocol.id)}
                  onChange={(e) => handleProtocolToggle(protocol.id, null, e.target.checked)}
                />
                {protocol.title}
              </label>
            )
          })}
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
                  {a.specific_date !== null ? a.specific_date : DAYS[a.day_of_week as number]} {a.start_time.slice(0, 5)}–
                  {a.end_time.slice(0, 5)}
                  {a.specific_date !== null && <span className="ml-1 text-xs text-gray-400">(one-time)</span>}
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
        <div className="mb-2 flex gap-3 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" checked={availMode === 'day'} onChange={() => setAvailMode('day')} />
            Every week on...
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={availMode === 'date'} onChange={() => setAvailMode('date')} />
            Specific date
          </label>
        </div>
        <form action={handleAddAvailability} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
