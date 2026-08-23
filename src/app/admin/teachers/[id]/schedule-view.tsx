import { conflictWindow } from '@/lib/matching/suggest'
import type { TeacherAvailability } from '@/lib/supabase/types'
import { dateForDayOfWeek } from '@/lib/week'
import { BUSINESS_TIMEZONE, dateStringInBusinessTz } from '@/lib/timezone'

// Column order follows the Monday-start week (weekStartDate is always a
// Monday), not JS's default Sunday-first day_of_week numbering — same
// convention as the teacher's own availability grid.
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const HOURS = Array.from({ length: 9 }, (_, i) => 8 + i) // 8:00 through 16:00 (last block ends 17:00)
const dayLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', timeZone: BUSINESS_TIMEZONE })

export interface SessionForSchedule {
  id: string
  recurrence_type: string
  start_time: string | null
  end_time: string | null
  day_of_week: number | null
  time_of_day_start: string | null
  time_of_day_end: string | null
  status: string
  studentName: string
  protocolName: string
}

function cellKey(day: number, hour: number) {
  return `${day}-${hour}`
}

export function ScheduleView({
  weekStartDate,
  availability,
  sessions,
}: {
  weekStartDate: string
  availability: TeacherAvailability[]
  sessions: SessionForSchedule[]
}) {
  const availableCells = new Set<string>()
  for (const a of availability) {
    const startHour = Number(a.start_time.slice(0, 2))
    const endHour = Number(a.end_time.slice(0, 2))
    for (let h = startHour; h < endHour; h++) availableCells.add(cellKey(a.day_of_week, h))
  }

  const byCell = new Map<string, SessionForSchedule[]>()
  for (const s of sessions) {
    const window = conflictWindow(s)
    if (!window) continue
    // A weekly-recurring session has no date of its own — it shows every
    // week it recurs through. A one-off only belongs on the specific week
    // its actual date falls in, not every week that happens to share its
    // day-of-week/time (conflictWindow only carries day-of-week + time).
    if (s.recurrence_type === 'one_off') {
      if (!s.start_time) continue
      const actualDate = dateStringInBusinessTz(new Date(s.start_time))
      if (actualDate !== dateForDayOfWeek(weekStartDate, window.dayOfWeek)) continue
    }
    const hour = Number(window.startTime.slice(0, 2))
    const key = cellKey(window.dayOfWeek, hour)
    const arr = byCell.get(key) ?? []
    arr.push(s)
    byCell.set(key, arr)
  }

  return (
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
            <tr key={hour} className="border-t border-gray-100">
              <td className="whitespace-nowrap p-1 text-right text-gray-500">{hour}:00</td>
              {DAY_ORDER.map((day) => {
                const isAvailable = availableCells.has(cellKey(day, hour))
                const here = byCell.get(cellKey(day, hour)) ?? []
                return (
                  <td key={day} className={`p-1 align-top ${isAvailable ? '' : 'bg-gray-50'}`}>
                    {here.length === 0 ? (
                      isAvailable && <span className="text-xs text-green-700">free</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {here.map((s) => (
                          <div
                            key={s.id}
                            className={`rounded px-1 py-0.5 text-xs ${
                              !isAvailable
                                ? 'border border-amber-300 bg-amber-50 text-amber-900'
                                : s.status === 'completed'
                                  ? 'bg-green-50 text-green-800'
                                  : s.status === 'accepted'
                                    ? 'bg-blue-50 text-blue-800'
                                    : 'bg-yellow-50 text-yellow-800'
                            }`}
                          >
                            <p className="font-medium leading-tight">{s.protocolName}</p>
                            <p className="leading-tight opacity-80">{s.studentName}</p>
                            {!isAvailable && <p className="leading-tight text-[10px] uppercase opacity-70">outside availability</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
