'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { addWeeks } from '@/lib/week'

/** Toggles a single full-hour block for one specific week (e.g. 9 -> 09:00-10:00) on or off. */
export async function toggleAvailabilityHour(weekStartDate: string, dayOfWeek: number, hour: number, enabled: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const startTime = `${String(hour).padStart(2, '0')}:00:00`
  const endTime = `${String(hour + 1).padStart(2, '0')}:00:00`

  if (enabled) {
    const { error } = await supabase.from('teacher_availability').insert({
      teacher_id: user.id,
      week_start_date: weekStartDate,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
    })
    if (error) return { error: 'Could not block that hour.' }
    revalidatePath('/teacher/availability')
    return { error: null }
  }

  // Clearing an hour can't just delete-by-exact-match: an existing row might
  // be a wider freeform window that only partially overlaps the hour being
  // cleared. Delete every row (in this week) overlapping [startTime, endTime)
  // and re-insert whatever part of each row falls outside that hour.
  const { data: rows, error: fetchError } = await supabase
    .from('teacher_availability')
    .select('id, start_time, end_time')
    .eq('teacher_id', user.id)
    .eq('week_start_date', weekStartDate)
    .eq('day_of_week', dayOfWeek)

  if (fetchError) return { error: 'Could not clear that hour.' }

  const overlapping = (rows ?? []).filter((r) => r.start_time < endTime && startTime < r.end_time)

  for (const row of overlapping) {
    const { error: deleteError } = await supabase.from('teacher_availability').delete().eq('id', row.id)
    if (deleteError) return { error: 'Could not clear that hour.' }

    const remainders: { start_time: string; end_time: string }[] = []
    if (row.start_time < startTime) remainders.push({ start_time: row.start_time, end_time: startTime })
    if (endTime < row.end_time) remainders.push({ start_time: endTime, end_time: row.end_time })

    if (remainders.length > 0) {
      const { error: reinsertError } = await supabase.from('teacher_availability').insert(
        remainders.map((r) => ({
          teacher_id: user.id,
          week_start_date: weekStartDate,
          day_of_week: dayOfWeek,
          ...r,
        }))
      )
      if (reinsertError) return { error: 'Could not clear that hour.' }
    }
  }

  revalidatePath('/teacher/availability')
  return { error: null }
}

/** Replaces this week's availability with an exact copy of the previous week's. */
export async function copyPreviousWeek(weekStartDate: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const previousWeekStart = addWeeks(weekStartDate, -1)

  const { data: previousRows, error: fetchError } = await supabase
    .from('teacher_availability')
    .select('day_of_week, start_time, end_time')
    .eq('teacher_id', user.id)
    .eq('week_start_date', previousWeekStart)

  if (fetchError) return { error: 'Could not read last week’s availability.' }
  if (!previousRows || previousRows.length === 0) return { error: 'No availability set last week to copy.' }

  const { error: deleteError } = await supabase
    .from('teacher_availability')
    .delete()
    .eq('teacher_id', user.id)
    .eq('week_start_date', weekStartDate)

  if (deleteError) return { error: 'Could not clear this week before copying.' }

  const { error: insertError } = await supabase.from('teacher_availability').insert(
    previousRows.map((r) => ({
      teacher_id: user.id,
      week_start_date: weekStartDate,
      day_of_week: r.day_of_week,
      start_time: r.start_time,
      end_time: r.end_time,
    }))
  )

  if (insertError) return { error: 'Could not copy last week’s availability.' }

  revalidatePath('/teacher/availability')
  return { error: null }
}
