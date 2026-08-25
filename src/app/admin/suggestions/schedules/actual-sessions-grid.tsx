import { dateForDayOfWeek } from '@/lib/week'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'

const WEEKDAYS = [1, 2, 3, 4, 5]
const DAY_NAMES: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' }
const HOURS = Array.from({ length: 9 }, (_, i) => 8 + i) // 8:00 through 16:00 (last block ends 17:00)
const dateLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', timeZone: BUSINESS_TIMEZONE })

export interface GridSession {
  id: string
  dayOfWeek: number
  startTime: string // "HH:MM"
  status: string
  studentName: string
  teacherName: string
  protocolName: string
}

function cellKey(day: number, hour: number) {
  return `${day}-${hour}`
}

/**
 * Read-only Mon–Fri grid of every real, currently-booked session (pending,
 * accepted, or completed) for one week — independent of whether it's tagged
 * into a schedule_batches row. Sits alongside the batch's own "sessions in
 * this schedule" list so it's obvious a batch showing 0 doesn't mean nothing
 * is actually booked that week — see the "Schedule 1 · 0 sessions" case.
 */
export function ActualSessionsGrid({ weekStartDate, sessions }: { weekStartDate: string; sessions: GridSession[] }) {
  if (sessions.length === 0) {
    return <p className="text-sm text-gray-500">No sessions actually booked for this week.</p>
  }

  const byCell = new Map<string, GridSession[]>()
  for (const s of sessions) {
    const key = cellKey(s.dayOfWeek, Number(s.startTime.slice(0, 2)))
    const arr = byCell.get(key) ?? []
    arr.push(s)
    byCell.set(key, arr)
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-yellow-200" /> Pending
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-200" /> Accepted
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-200" /> Completed
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-1"></th>
            {WEEKDAYS.map((day) => (
              <th key={day} className="p-1 text-center font-medium text-gray-600">
                {DAY_NAMES[day]}
                <div className="font-normal text-gray-400">
                  {dateLabelFormatter.format(new Date(`${dateForDayOfWeek(weekStartDate, day)}T00:00:00Z`))}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((hour) => (
            <tr key={hour} className="border-t border-gray-100">
              <td className="whitespace-nowrap p-1 text-right text-gray-500">{hour}:00</td>
              {WEEKDAYS.map((day) => {
                const here = byCell.get(cellKey(day, hour)) ?? []
                return (
                  <td key={day} className="p-1 align-top">
                    <div className="flex flex-col gap-1">
                      {here.map((s) => {
                        // Same status coloring used on the teacher's, owner's
                        // teacher-view, and parent's calendar grids.
                        const colors =
                          s.status === 'completed'
                            ? 'bg-green-50 text-green-800'
                            : s.status === 'accepted'
                              ? 'bg-blue-50 text-blue-800'
                              : 'bg-yellow-50 text-yellow-800'
                        return (
                          <div key={s.id} className={`rounded px-1 py-0.5 ${colors}`}>
                            <p className="font-medium leading-tight">
                              {s.studentName} — {s.protocolName}
                            </p>
                            <p className="leading-tight">{s.teacherName}</p>
                          </div>
                        )
                      })}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
