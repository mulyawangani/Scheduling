import { addWeeks, dateForDayOfWeek, getWeekStart } from './week'
import { dateStringInBusinessTz, dayOfWeekInBusinessTz, formatTimeInBusinessTz } from './timezone'

/** A session_plans row as the parent screens read it. */
export interface SessionRowLike {
  id: string
  recurrence_type: string
  start_time: string | null
  end_time?: string | null
  day_of_week: number | null
  time_of_day_start: string | null
  time_of_day_end?: string | null
  status: string
  protocols: { title: string } | { title: string }[] | null
  profiles: { name: string } | { name: string }[] | null
}

/** One therapy on the calendar in a given week. */
export interface WeekSession {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM, 24 hour */
  startTime: string
  endTime: string | null
  title: string
  teacher: string | null
  status: string
}

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/**
 * Every session on the calendar in one Monday-start week, in time order: a weekly session sits on its
 * day every week, a one-off only in the week of its own date. Monday to Friday only, as the scheduler
 * places nothing else.
 */
export function sessionsInWeek(rows: SessionRowLike[], weekStart: string): WeekSession[] {
  const friday = dateForDayOfWeek(weekStart, 5)
  const out: WeekSession[] = []
  for (const s of rows) {
    const title = first(s.protocols)?.title ?? 'Therapy'
    const teacher = first(s.profiles)?.name ?? null
    if (s.recurrence_type === 'weekly') {
      if (s.day_of_week == null || s.day_of_week < 1 || s.day_of_week > 5 || !s.time_of_day_start) continue
      out.push({
        id: s.id,
        date: dateForDayOfWeek(weekStart, s.day_of_week),
        startTime: s.time_of_day_start.slice(0, 5),
        endTime: s.time_of_day_end ? s.time_of_day_end.slice(0, 5) : null,
        title,
        teacher,
        status: s.status,
      })
    } else if (s.start_time) {
      const start = new Date(s.start_time)
      const date = dateStringInBusinessTz(start)
      if (date < weekStart || date > friday) continue
      out.push({
        id: s.id,
        date,
        startTime: formatTimeInBusinessTz(start).slice(0, 5),
        endTime: s.end_time ? formatTimeInBusinessTz(new Date(s.end_time)).slice(0, 5) : null,
        title,
        teacher,
        status: s.status,
      })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}

/**
 * The week a parent's Home and Calendar open on: this week from Monday to Friday, and the coming week
 * on a Saturday or Sunday (the week just ended has nothing left to show).
 */
export function parentWeek(now: Date = new Date()): { weekStart: string; isNextWeek: boolean } {
  const monday = getWeekStart(now)
  const dayOfWeek = dayOfWeekInBusinessTz(now)
  const weekend = dayOfWeek === 0 || dayOfWeek === 6
  return { weekStart: weekend ? addWeeks(monday, 1) : monday, isNextWeek: weekend }
}

/** "14:00" as "2:00 PM". */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m ?? 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** What a parent sees for a session's status. A no-show is a session the teacher marked because the child did not come and it was not cancelled. */
export const STATUS_LABEL: Record<string, string> = { accepted: 'Confirmed', pending: 'Pending', completed: 'Completed', no_show: 'No-show' }
