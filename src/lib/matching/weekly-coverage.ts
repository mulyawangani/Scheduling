import { conflictWindow } from './suggest'
import { dateForDayOfWeek, weeksInMonthOf } from '@/lib/week'
import { dateStringInBusinessTz } from '@/lib/timezone'

const WEEKDAYS = [1, 2, 3, 4, 5] // Monday–Friday, same as the scheduler

export interface BookedSessionRow {
  recurrence_type: string
  start_time: string | null
  end_time: string | null
  day_of_week: number | null
  time_of_day_start: string | null
  time_of_day_end: string | null
}

/**
 * How many of the given sessions (pending, accepted or completed) fall in one Monday-start week.
 * Same rule as `existing` in generate-schedule.ts: a weekly session counts in every week, a
 * one-off in the week of its own date, Monday to Friday only.
 */
export function countSessionsInWeek(sessions: BookedSessionRow[], weekStartDate: string): number {
  const fridayDate = dateForDayOfWeek(weekStartDate, 5)
  let count = 0
  for (const row of sessions) {
    const window = conflictWindow(row)
    if (!window || !WEEKDAYS.includes(window.dayOfWeek)) continue
    const date =
      row.recurrence_type === 'weekly'
        ? dateForDayOfWeek(weekStartDate, window.dayOfWeek)
        : row.start_time
          ? dateStringInBusinessTz(new Date(row.start_time))
          : null
    if (!date || date < weekStartDate || date > fridayDate) continue
    count += 1
  }
  return count
}

/**
 * One week's share of the monthly target. The monthly target is one session for every child and
 * protocol need; scheduling is weekly, so each week is judged against that target divided by the
 * weeks in its month (a week belongs to the month of its Monday, the rule the scheduler uses to
 * decide a need is covered "this month").
 */
export function weeklyTarget(monthlyTarget: number, weekStartDate: string): number {
  return monthlyTarget / weeksInMonthOf(weekStartDate)
}
