/** Monday-start ISO week helpers, shared by the availability grid, the owner's schedule view, and the matching algorithm. */

import { dateStringInBusinessTz, BUSINESS_TIMEZONE } from './timezone'

/** The Monday (as YYYY-MM-DD) of the week containing `date`, determined in the business timezone. */
export function getWeekStart(date: Date): string {
  const dateStr = dateStringInBusinessTz(date)
  const d = new Date(`${dateStr}T00:00:00Z`)
  const day = d.getUTCDay() // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diffToMonday)
  return d.toISOString().slice(0, 10)
}

/** The upcoming week — teachers set availability ahead of time, not for the week already in progress. */
export function getUpcomingWeekStart(): string {
  return addWeeks(getWeekStart(new Date()), 1)
}

export function addWeeks(weekStart: string, n: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

const labelFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TIMEZONE })
const labelFormatterWithYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: BUSINESS_TIMEZONE,
})

export function formatWeekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`)
  const end = new Date(`${weekStart}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  return `${labelFormatter.format(start)} – ${labelFormatterWithYear.format(end)}`
}

/** The Monday of every week filed under `month` (YYYY-MM): the Monday-start weeks whose Monday falls in that month. */
export function weekStartsInMonth(month: string): string[] {
  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  const mondays: string[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(Date.UTC(year, mon - 1, day)).getUTCDay() === 1) mondays.push(`${month}-${String(day).padStart(2, '0')}`)
  }
  return mondays
}

/**
 * How many Monday-start weeks belong to the month that `weekStart` falls in. A week is filed under the
 * month of its Monday (the rule getUnmetNeeds uses for "covered this month"), so this is the number of
 * Mondays in that month: 4 or 5.
 */
export function weeksInMonthOf(weekStart: string): number {
  return weekStartsInMonth(weekStart.slice(0, 7)).length
}

export function dateForDayOfWeek(weekStart: string, dayOfWeek: number): string {
  // weekStart is Monday (ISO day 1); dayOfWeek uses JS convention (0 = Sunday).
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const d = new Date(`${weekStart}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + mondayOffset)
  return d.toISOString().slice(0, 10)
}
