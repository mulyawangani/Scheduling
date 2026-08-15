import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface FreeWindow {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface SuggestionCandidate {
  teacherId: string
  teacherName: string
  rating: number
  activeLoad: number
  freeWindows: FreeWindow[]
  score: number
  scorePercent: number
}

/**
 * A 0-100 "how optimal is this match" score, independent of the internal
 * ranking `score` (which only needs to sort candidates, not be human-legible).
 * rating=null means the teacher has no capability rating for the subject at
 * all (only reachable via a manual override) — scored 0, since there's no
 * basis to call it a good match. Each already-booked session on the teacher
 * shaves off a load penalty, capped so a busy 5-star teacher never scores
 * below a poorly-rated idle one.
 */
export function matchScorePercent(rating: number | null, activeLoad: number): number {
  if (rating === null) return 0
  const ratingComponent = (rating / 5) * 100
  const loadPenalty = Math.min(activeLoad * 5, 30)
  return Math.max(0, Math.round(ratingComponent - loadPenalty))
}

/**
 * Score an arbitrary (teacherId, subjectId) pairing at assignment time —
 * used for both algorithm-approved and manually-overridden assignments, so a
 * manual pick that ignores capability/load is visibly scored lower.
 */
export async function computeMatchScore(
  supabase: SupabaseClient<Database>,
  teacherId: string,
  subjectId: string
): Promise<number> {
  const [{ data: capability }, { count }] = await Promise.all([
    supabase
      .from('teacher_capabilities')
      .select('rating')
      .eq('teacher_id', teacherId)
      .eq('subject_id', subjectId)
      .maybeSingle(),
    supabase
      .from('session_plans')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .in('status', ['pending', 'accepted']),
  ])

  return matchScorePercent(capability?.rating ?? null, count ?? 0)
}

function maxTime(a: string, b: string) {
  return a > b ? a : b
}
function minTime(a: string, b: string) {
  return a < b ? a : b
}

interface ConflictWindow {
  dayOfWeek: number
  startTime: string
  endTime: string
}

/** Reduce a session_plans row (one-off or weekly) to a comparable (day, time-range) window. */
function conflictWindow(plan: {
  recurrence_type: string
  start_time: string | null
  end_time: string | null
  day_of_week: number | null
  time_of_day_start: string | null
  time_of_day_end: string | null
}): ConflictWindow | null {
  if (plan.recurrence_type === 'weekly') {
    if (plan.day_of_week === null || !plan.time_of_day_start || !plan.time_of_day_end) return null
    return { dayOfWeek: plan.day_of_week, startTime: plan.time_of_day_start, endTime: plan.time_of_day_end }
  }
  if (!plan.start_time || !plan.end_time) return null
  const start = new Date(plan.start_time)
  const end = new Date(plan.end_time)
  return {
    dayOfWeek: start.getDay(),
    startTime: start.toTimeString().slice(0, 8),
    endTime: end.toTimeString().slice(0, 8),
  }
}

function windowsOverlap(a: ConflictWindow, b: ConflictWindow) {
  return a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && b.startTime < a.endTime
}

/**
 * Given a student's unmet need (subjectId), find qualified teachers with
 * overlapping availability and no scheduling conflict, ranked by rating
 * (primary) then current load (secondary, for fairness).
 */
export async function suggestTeachers(
  supabase: SupabaseClient<Database>,
  studentId: string,
  subjectId: string
): Promise<SuggestionCandidate[]> {
  const [{ data: studentWindows }, { data: capabilities }] = await Promise.all([
    supabase.from('student_availability').select('day_of_week, start_time, end_time').eq('student_id', studentId),
    supabase
      .from('teacher_capabilities')
      .select('teacher_id, rating, profiles!teacher_capabilities_teacher_id_fkey(name)')
      .eq('subject_id', subjectId),
  ])

  if (!studentWindows || studentWindows.length === 0 || !capabilities || capabilities.length === 0) {
    return []
  }

  const candidates: SuggestionCandidate[] = []

  for (const cap of capabilities) {
    const [{ data: teacherWindows }, { data: conflicts }] = await Promise.all([
      supabase
        .from('teacher_availability')
        .select('day_of_week, start_time, end_time')
        .eq('teacher_id', cap.teacher_id),
      supabase
        .from('session_plans')
        .select('recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end')
        .eq('teacher_id', cap.teacher_id)
        .in('status', ['pending', 'accepted']),
    ])

    const conflictWindows = (conflicts ?? [])
      .map(conflictWindow)
      .filter((w): w is ConflictWindow => w !== null)

    const freeWindows: FreeWindow[] = []
    for (const sw of studentWindows) {
      for (const tw of teacherWindows ?? []) {
        if (sw.day_of_week !== tw.day_of_week) continue
        const start = maxTime(sw.start_time, tw.start_time)
        const end = minTime(sw.end_time, tw.end_time)
        if (start >= end) continue

        const candidate: ConflictWindow = { dayOfWeek: sw.day_of_week, startTime: start, endTime: end }
        const blocked = conflictWindows.some((c) => windowsOverlap(c, candidate))
        if (blocked) continue

        freeWindows.push({ dayOfWeek: sw.day_of_week, startTime: start, endTime: end })
      }
    }

    if (freeWindows.length === 0) continue

    const activeLoad = conflicts?.length ?? 0
    const teacherName = Array.isArray(cap.profiles) ? cap.profiles[0]?.name : cap.profiles?.name

    candidates.push({
      teacherId: cap.teacher_id,
      teacherName: teacherName ?? 'Unknown teacher',
      rating: cap.rating,
      activeLoad,
      freeWindows,
      score: cap.rating * 10 - activeLoad,
      scorePercent: matchScorePercent(cap.rating, activeLoad),
    })
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 3)
}
