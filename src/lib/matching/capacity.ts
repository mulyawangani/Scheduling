import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { conflictWindow, type ConflictWindow } from './suggest'
import { dateStringInBusinessTz } from '@/lib/timezone'

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

export type CapacityCheck = { ok: true } | { ok: false; error: string }

/**
 * Checks a proposed session against every capacity_rules band it overlaps.
 * A band caps how many sessions (across all teachers) may run at the same
 * instant within [start_time, end_time) on any day — swept at hour
 * granularity, matching the hourly grid used everywhere else in the app.
 *
 * `proposedDate` (YYYY-MM-DD) should be passed for a one-off proposal. A
 * one-off session only really happens on its own specific date, so it only
 * counts against another one-off on that exact same date — not merely
 * because both fall on the same weekday in different weeks, which would
 * otherwise make capacity keep tightening forever as one-off history
 * accumulates. A weekly session recurs every week on its weekday, so it
 * always counts regardless of date.
 */
export async function checkCapacity(
  supabase: SupabaseClient<Database>,
  proposed: ConflictWindow,
  proposedDate?: string
): Promise<CapacityCheck> {
  const { data: rules } = await supabase.from('capacity_rules').select('*')
  if (!rules || rules.length === 0) return { ok: true }

  const newStart = timeToMinutes(proposed.startTime)
  const newEnd = timeToMinutes(proposed.endTime)

  const { data: existing } = await supabase
    .from('session_plans')
    .select('recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end')
    .in('status', ['pending', 'accepted', 'completed'])

  const sameDayWindows = (existing ?? []).flatMap((row) => {
    const w = conflictWindow(row)
    if (!w || w.dayOfWeek !== proposed.dayOfWeek) return []
    if (row.recurrence_type === 'one_off') {
      if (!proposedDate || !row.start_time) return []
      if (dateStringInBusinessTz(new Date(row.start_time)) !== proposedDate) return []
    }
    return [{ start: timeToMinutes(w.startTime), end: timeToMinutes(w.endTime) }]
  })

  for (const rule of rules) {
    const ruleStart = timeToMinutes(rule.start_time)
    const ruleEnd = timeToMinutes(rule.end_time)
    const overlapStart = Math.max(newStart, ruleStart)
    const overlapEnd = Math.min(newEnd, ruleEnd)
    if (overlapStart >= overlapEnd) continue

    for (let t = overlapStart; t < overlapEnd; t += 60) {
      const concurrent = sameDayWindows.filter((w) => minutesOverlap(w.start, w.end, t, t + 60)).length + 1
      if (concurrent > rule.max_concurrent) {
        return {
          ok: false,
          error: `Center capacity exceeded: at most ${rule.max_concurrent} concurrent sessions allowed between ${rule.start_time.slice(0, 5)}–${rule.end_time.slice(0, 5)}.`,
        }
      }
    }
  }

  return { ok: true }
}
