'use client'

import { useState, useTransition } from 'react'
import type { TeacherAvailability } from '@/lib/supabase/types'
import { dateForDayOfWeek } from '@/lib/week'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'
import { toggleAvailabilityHour } from './actions'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Column order follows the Monday-start week (weekStartDate is always a
// Monday), not JS's default Sunday-first day_of_week numbering.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const HOURS = Array.from({ length: 9 }, (_, i) => 8 + i) // 8:00 through 16:00 (last block ends 17:00)

const dayLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', timeZone: BUSINESS_TIMEZONE })

function cellKey(day: number, hour: number) {
  return `${day}-${hour}`
}

export function AvailabilityGrid({
  weekStartDate,
  availability,
}: {
  weekStartDate: string
  availability: TeacherAvailability[]
}) {
  const [blocked, setBlocked] = useState(() => {
    // Rows may span multiple hours (e.g. legacy freeform windows from before
    // this grid existed) — expand each into every hourly cell it covers.
    const set = new Set<string>()
    for (const a of availability) {
      const startHour = Number(a.start_time.slice(0, 2))
      const endHour = Number(a.end_time.slice(0, 2))
      for (let h = startHour; h < endHour; h++) {
        set.add(cellKey(a.day_of_week, h))
      }
    }
    return set
  })
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle(day: number, hour: number) {
    const key = cellKey(day, hour)
    const willBeEnabled = !blocked.has(key)

    setBlocked((prev) => {
      const next = new Set(prev)
      if (willBeEnabled) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
    setError(null)

    startTransition(async () => {
      const result = await toggleAvailabilityHour(weekStartDate, day, hour, willBeEnabled)
      if (result.error) {
        setError(result.error)
        // revert optimistic update
        setBlocked((prev) => {
          const next = new Set(prev)
          if (willBeEnabled) {
            next.delete(key)
          } else {
            next.add(key)
          }
          return next
        })
      }
    })
  }

  return (
    <div>
      <p className="mb-3 text-sm text-gray-500">
        Click an hour to mark yourself available for this week. This is what the scheduling algorithm matches
        against.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-1"></th>
              {DAY_ORDER.map((day) => (
                <th key={day} className="p-1 text-center font-medium text-gray-600">
                  {DAY_NAMES[day]}
                  <div className="font-normal text-gray-400">
                    {dayLabelFormatter.format(new Date(`${dateForDayOfWeek(weekStartDate, day)}T00:00:00Z`))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour}>
                <td className="whitespace-nowrap p-1 text-right text-gray-500">{hour}:00</td>
                {DAY_ORDER.map((day) => {
                  const isOn = blocked.has(cellKey(day, hour))
                  return (
                    <td key={day} className="p-1 text-center">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggle(day, hour)}
                        aria-label={`${DAY_NAMES[day]} ${hour}:00-${hour + 1}:00`}
                        className={`h-8 w-8 rounded ${
                          isOn ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-100 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
