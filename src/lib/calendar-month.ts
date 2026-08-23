/** Monday-start month-grid helpers for the owner's holiday calendar. */

import { dateStringInBusinessTz } from './timezone'

/** "YYYY-MM" for the current month, in the business timezone. */
export function currentMonthParam(): string {
  return dateStringInBusinessTz(new Date()).slice(0, 7)
}

export function addMonths(monthParam: string, n: number): string {
  const [y, m] = monthParam.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const monthLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export function formatMonthLabel(monthParam: string): string {
  const [y, m] = monthParam.split('-').map(Number)
  return monthLabelFormatter.format(new Date(Date.UTC(y, m - 1, 1)))
}

/** Every "YYYY-MM-DD" in the Monday-start weeks that touch this month (pads with adjacent-month days). */
export function getMonthGridDays(monthParam: string): string[] {
  const [y, m] = monthParam.split('-').map(Number)

  const first = new Date(Date.UTC(y, m - 1, 1))
  const firstWeekday = first.getUTCDay() // 0 = Sunday
  const gridStart = new Date(first)
  gridStart.setUTCDate(gridStart.getUTCDate() + (firstWeekday === 0 ? -6 : 1 - firstWeekday))

  const last = new Date(Date.UTC(y, m, 0)) // last day of this month
  const lastWeekday = last.getUTCDay()
  const gridEnd = new Date(last)
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (lastWeekday === 0 ? 0 : 7 - lastWeekday))

  const days: string[] = []
  for (const cur = new Date(gridStart); cur <= gridEnd; cur.setUTCDate(cur.getUTCDate() + 1)) {
    days.push(cur.toISOString().slice(0, 10))
  }
  return days
}
