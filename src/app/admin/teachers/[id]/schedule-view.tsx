import { conflictWindow, windowsOverlap, type ConflictWindow } from '@/lib/matching/suggest'
import type { TeacherAvailability } from '@/lib/supabase/types'
import { dateForDayOfWeek } from '@/lib/week'
import { BUSINESS_TIMEZONE, formatTimeInBusinessTz } from '@/lib/timezone'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// weekStartDate is always a Monday — walk the week in calendar order, not JS's Sunday-first day_of_week numbering.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TIMEZONE })

export interface SessionForSchedule {
  id: string
  recurrence_type: string
  start_time: string | null
  end_time: string | null
  day_of_week: number | null
  time_of_day_start: string | null
  time_of_day_end: string | null
  studentName: string
  protocolName: string
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
  const sessionWindows = sessions
    .map((s) => ({ session: s, window: conflictWindow(s) }))
    .filter((sw): sw is { session: SessionForSchedule; window: ConflictWindow } => sw.window !== null)

  const matchedSessionIds = new Set<string>()

  const byDay = DAY_ORDER.map((day) => ({
    day,
    windows: availability.filter((a) => a.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time)),
  })).filter((d) => d.windows.length > 0)

  return (
    <div className="flex flex-col gap-4">
      {byDay.length === 0 ? (
        <p className="text-sm text-gray-500">No availability set yet.</p>
      ) : (
        byDay.map(({ day, windows }) => (
          <div key={day}>
            <p className="text-sm font-medium text-gray-700">
              {DAYS[day]} <span className="font-normal text-gray-400">{dateFormatter.format(new Date(`${dateForDayOfWeek(weekStartDate, day)}T00:00:00Z`))}</span>
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {windows.map((w) => {
                const availWindow: ConflictWindow = {
                  dayOfWeek: w.day_of_week,
                  startTime: w.start_time,
                  endTime: w.end_time,
                }
                const booked = sessionWindows.filter((sw) => windowsOverlap(sw.window, availWindow))
                booked.forEach((b) => matchedSessionIds.add(b.session.id))

                return (
                  <li key={w.id} className="rounded-lg border border-gray-200 p-2 text-sm">
                    <span className="text-gray-600">
                      {w.start_time.slice(0, 5)}–{w.end_time.slice(0, 5)}
                    </span>
                    {booked.length === 0 ? (
                      <span className="ml-2 text-green-700">free</span>
                    ) : (
                      <ul className="mt-1 flex flex-col gap-0.5 pl-3">
                        {booked.map(({ session, window }) => (
                          <li key={session.id} className="text-gray-800">
                            {window.startTime.slice(0, 5)}–{window.endTime.slice(0, 5)} · {session.studentName} —{' '}
                            {session.protocolName}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}

      {sessions.filter((s) => !matchedSessionIds.has(s.id)).length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700">Booked outside declared availability</p>
          <ul className="mt-1 flex flex-col gap-1">
            {sessions
              .filter((s) => !matchedSessionIds.has(s.id))
              .map((s) => {
                const when =
                  s.recurrence_type === 'one_off' && s.start_time && s.end_time
                    ? `${dateFormatter.format(new Date(s.start_time))} ${formatTimeInBusinessTz(new Date(s.start_time)).slice(0, 5)}–${formatTimeInBusinessTz(new Date(s.end_time)).slice(0, 5)}`
                    : `Every ${DAYS[s.day_of_week ?? 0]} ${s.time_of_day_start?.slice(0, 5)}–${s.time_of_day_end?.slice(0, 5)}`
                return (
                  <li key={s.id} className="rounded-lg border border-yellow-200 bg-yellow-50 p-2 text-sm">
                    {when} · {s.studentName} — {s.protocolName}
                  </li>
                )
              })}
          </ul>
        </div>
      )}
    </div>
  )
}
