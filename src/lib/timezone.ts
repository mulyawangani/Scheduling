/**
 * The whole app treats this as the source of truth for "what time is it" —
 * every date/time display and every naive local datetime the owner types in
 * is interpreted in this zone, regardless of which server (local dev vs.
 * Vercel production, which default to different clocks) renders the page.
 * WIB has no DST, so a fixed +07:00 offset is always correct.
 */
export const BUSINESS_TIMEZONE = 'Asia/Jakarta'
const BUSINESS_UTC_OFFSET = '+07:00'

/** "HH:MM:SS" for an instant, in the business timezone. */
export function formatTimeInBusinessTz(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('hour')}:${get('minute')}:${get('second')}`
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Day of week (0=Sunday..6=Saturday) for an instant, in the business timezone. */
export function dayOfWeekInBusinessTz(date: Date): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TIMEZONE, weekday: 'short' }).format(date)
  return WEEKDAY_INDEX[weekday] ?? 0
}

/** "YYYY-MM-DD" for an instant, in the business timezone. */
export function dateStringInBusinessTz(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * Converts a naive "YYYY-MM-DDTHH:MM" or "YYYY-MM-DDTHH:MM:SS" string
 * (assumed to already be business-timezone wall-clock time — e.g. straight
 * from a <input type="datetime-local"> or a date+time the owner picked) into
 * a real UTC instant, correctly regardless of which server runs this code.
 */
export function businessLocalToISOString(naiveDateTime: string): string {
  return new Date(`${naiveDateTime}${BUSINESS_UTC_OFFSET}`).toISOString()
}
