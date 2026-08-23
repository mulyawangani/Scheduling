import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { getUpcomingWeekStart, dateForDayOfWeek } from '@/lib/week'
import { dayOfWeekInBusinessTz, formatTimeInBusinessTz } from '@/lib/timezone'

export interface FreeWindow {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface SuggestionCandidate {
  teacherId: string
  teacherName: string
  rating: number
  coverageCount: number
  totalNeeded: number
  activeLoad: number
  freeWindows: FreeWindow[]
  score: number
  scorePercent: number
}

/**
 * A 0-100 "how optimal is this match" score, independent of the internal
 * ranking `score` (which only needs to sort candidates, not be human-legible).
 * rating=null means the teacher has no protocol assignment at all (only
 * reachable via a manual override) — scored 0, since there's no basis to
 * call it a good match. Each already-booked session on the teacher shaves
 * off a load penalty, capped so a busy 5-star teacher never scores below a
 * poorly-rated idle one.
 */
export function matchScorePercent(rating: number | null, activeLoad: number): number {
  if (rating === null) return 0
  const ratingComponent = (rating / 5) * 100
  const loadPenalty = Math.min(activeLoad * 5, 30)
  return Math.max(0, Math.round(ratingComponent - loadPenalty))
}

export interface ProtocolQualification {
  teacherId: string
  teacherName: string
  rating: number
  coverageCount: number
  totalNeeded: number
}

type TeacherRowsByProtocol = Map<string, Map<string, { teacherName: string; bySub: Map<string, number> }>>

/**
 * Groups raw teacher_protocols rows into protocolId -> teacherId -> (sub-protocol
 * or '__protocol__') -> her best rating there. Shared in-memory shape used by both
 * an upfront bulk load (Generate Schedule, Recommendation ranking) and the
 * single-protocol query below, so the coverage/rating math itself lives in one place.
 */
export function groupTeacherProtocolRows(
  rows: { teacher_id: string; protocol_id: string; sub_protocol_id: string | null; rating: number; teacherName: string }[]
): TeacherRowsByProtocol {
  const byProtocol: TeacherRowsByProtocol = new Map()
  for (const row of rows) {
    const byTeacher = byProtocol.get(row.protocol_id) ?? new Map()
    const entry = byTeacher.get(row.teacher_id) ?? { teacherName: row.teacherName, bySub: new Map<string, number>() }
    const subKey = row.sub_protocol_id ?? '__protocol__'
    const existingRating = entry.bySub.get(subKey)
    if (existingRating === undefined || row.rating > existingRating) entry.bySub.set(subKey, row.rating)
    byTeacher.set(row.teacher_id, entry)
    byProtocol.set(row.protocol_id, byTeacher)
  }
  return byProtocol
}

/**
 * A protocol like Reflex Repatterning is one bookable session even when the
 * child needs several of its sub-protocols — a teacher works through
 * whichever of them she's qualified for in that single sitting. So a
 * teacher's qualification here isn't just "her best rating for this
 * protocol" — it's how many of THIS CHILD'S specific needed sub-protocols
 * she covers (coverageCount), tie-broken by her average rating across the
 * ones she covers. For a protocol with no sub-items (neededSubProtocolIds
 * empty), this collapses back to her best single rating for the protocol.
 * Sorted best-first: fullest coverage, then highest rating.
 */
export function coverageQualificationsFromGroup(
  byProtocol: TeacherRowsByProtocol,
  protocolId: string,
  neededSubProtocolIds: string[]
): ProtocolQualification[] {
  const byTeacher = byProtocol.get(protocolId)
  if (!byTeacher) return []
  const totalNeeded = neededSubProtocolIds.length || 1
  const results: ProtocolQualification[] = []
  for (const [teacherId, entry] of byTeacher) {
    if (neededSubProtocolIds.length === 0) {
      const ratings = Array.from(entry.bySub.values())
      if (ratings.length === 0) continue
      results.push({ teacherId, teacherName: entry.teacherName, rating: Math.max(...ratings), coverageCount: 1, totalNeeded })
      continue
    }
    const covered = neededSubProtocolIds.filter((id) => entry.bySub.has(id))
    if (covered.length === 0) continue
    const avgRating = covered.reduce((sum, id) => sum + (entry.bySub.get(id) ?? 0), 0) / covered.length
    results.push({ teacherId, teacherName: entry.teacherName, rating: avgRating, coverageCount: covered.length, totalNeeded })
  }
  return results.sort((a, b) => b.coverageCount - a.coverageCount || b.rating - a.rating)
}

export async function getCoverageQualifications(
  supabase: SupabaseClient<Database>,
  protocolId: string,
  neededSubProtocolIds: string[]
): Promise<ProtocolQualification[]> {
  const { data } = await supabase
    .from('teacher_protocols')
    .select('teacher_id, protocol_id, sub_protocol_id, rating, profiles!teacher_protocols_teacher_id_fkey(name)')
    .eq('protocol_id', protocolId)

  const rows = (data ?? []).map((row) => ({
    teacher_id: row.teacher_id,
    protocol_id: row.protocol_id,
    sub_protocol_id: row.sub_protocol_id,
    rating: row.rating,
    teacherName: (Array.isArray(row.profiles) ? row.profiles[0]?.name : row.profiles?.name) ?? 'Unknown teacher',
  }))
  return coverageQualificationsFromGroup(groupTeacherProtocolRows(rows), protocolId, neededSubProtocolIds)
}

/**
 * Score an arbitrary (teacherId, protocolId) pairing at assignment time —
 * used for both algorithm-approved and manually-overridden assignments, so a
 * manual pick that ignores qualification/load is visibly scored lower.
 * Coverage-aware: uses the student's actual needed sub-protocols under this
 * protocol (if any) so the stored score matches what was shown pre-commit.
 */
export async function computeMatchScore(
  supabase: SupabaseClient<Database>,
  studentId: string,
  teacherId: string,
  protocolId: string
): Promise<number> {
  const { data: neededRows } = await supabase
    .from('student_protocols')
    .select('sub_protocol_id')
    .eq('student_id', studentId)
    .eq('protocol_id', protocolId)
  const neededSubProtocolIds = (neededRows ?? [])
    .map((r) => r.sub_protocol_id)
    .filter((id): id is string => id !== null)

  const [qualifications, { count }] = await Promise.all([
    getCoverageQualifications(supabase, protocolId, neededSubProtocolIds),
    supabase
      .from('session_plans')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .in('status', ['pending', 'accepted']),
  ])

  const rating = qualifications.find((q) => q.teacherId === teacherId)?.rating ?? null
  return matchScorePercent(rating, count ?? 0)
}

function maxTime(a: string, b: string) {
  return a > b ? a : b
}
function minTime(a: string, b: string) {
  return a < b ? a : b
}

export interface ConflictWindow {
  dayOfWeek: number
  startTime: string
  endTime: string
}

/** Reduce a session_plans row (one-off or weekly) to a comparable (day, time-range) window. */
export function conflictWindow(plan: {
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
    dayOfWeek: dayOfWeekInBusinessTz(start),
    startTime: formatTimeInBusinessTz(start),
    endTime: formatTimeInBusinessTz(end),
  }
}

export function windowsOverlap(a: ConflictWindow, b: ConflictWindow) {
  return a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && b.startTime < a.endTime
}

/**
 * Given a student's unmet need (protocolId), find qualified teachers with
 * overlapping availability and no scheduling conflict, ranked by how many of
 * the child's specific needed sub-protocols they cover (primary), then
 * rating (secondary), then current load (tertiary, for fairness). Teacher
 * availability is scoped to one specific week (teachers upload a fresh
 * weekly schedule rather than a standing pattern) — defaults to the
 * upcoming week.
 */
export async function suggestTeachers(
  supabase: SupabaseClient<Database>,
  studentId: string,
  protocolId: string,
  weekStartDate: string = getUpcomingWeekStart()
): Promise<SuggestionCandidate[]> {
  const [{ data: studentWindows }, { data: neededRows }] = await Promise.all([
    supabase.from('student_availability').select('day_of_week, specific_date, start_time, end_time').eq('student_id', studentId),
    supabase.from('student_protocols').select('sub_protocol_id').eq('student_id', studentId).eq('protocol_id', protocolId),
  ])

  const neededSubProtocolIds = (neededRows ?? [])
    .map((r) => r.sub_protocol_id)
    .filter((id): id is string => id !== null)

  const qualifications = await getCoverageQualifications(supabase, protocolId, neededSubProtocolIds)

  if (!studentWindows || studentWindows.length === 0 || qualifications.length === 0) {
    return []
  }

  const candidates: SuggestionCandidate[] = []

  for (const qual of qualifications) {
    const [{ data: teacherWindows }, { data: conflicts }] = await Promise.all([
      supabase
        .from('teacher_availability')
        .select('day_of_week, start_time, end_time')
        .eq('teacher_id', qual.teacherId)
        .eq('week_start_date', weekStartDate),
      supabase
        .from('session_plans')
        .select('recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end')
        .eq('teacher_id', qual.teacherId)
        .in('status', ['pending', 'accepted']),
    ])

    const conflictWindows = (conflicts ?? [])
      .map(conflictWindow)
      .filter((w): w is ConflictWindow => w !== null)

    const freeWindows: FreeWindow[] = []
    for (const sw of studentWindows) {
      for (const tw of teacherWindows ?? []) {
        // A recurring student window matches by weekday; a specific-date one
        // only matches the teacher's window for the day that actually falls
        // on that date within the target week.
        const matchesRecurring = sw.day_of_week !== null && sw.day_of_week === tw.day_of_week
        const matchesSpecificDate = sw.specific_date !== null && sw.specific_date === dateForDayOfWeek(weekStartDate, tw.day_of_week)
        if (!matchesRecurring && !matchesSpecificDate) continue
        const start = maxTime(sw.start_time, tw.start_time)
        const end = minTime(sw.end_time, tw.end_time)
        if (start >= end) continue

        const candidate: ConflictWindow = { dayOfWeek: tw.day_of_week, startTime: start, endTime: end }
        const blocked = conflictWindows.some((c) => windowsOverlap(c, candidate))
        if (blocked) continue

        freeWindows.push({ dayOfWeek: tw.day_of_week, startTime: start, endTime: end })
      }
    }

    if (freeWindows.length === 0) continue

    const activeLoad = conflicts?.length ?? 0

    candidates.push({
      teacherId: qual.teacherId,
      teacherName: qual.teacherName,
      rating: qual.rating,
      coverageCount: qual.coverageCount,
      totalNeeded: qual.totalNeeded,
      activeLoad,
      freeWindows,
      score: qual.coverageCount * 1000 + qual.rating * 10 - activeLoad,
      scorePercent: matchScorePercent(qual.rating, activeLoad),
    })
  }

  return candidates.sort((a, b) => b.score - a.score)
}

export interface TimeSlotCandidate {
  teacherId: string
  teacherName: string
  rating: number
  coverageCount: number
  totalNeeded: number
  activeLoad: number
  scorePercent: number
}

/**
 * Given a day/time window the owner picked by hand (rather than one the
 * algorithm already found as a mutual overlap), which qualified teachers are
 * actually free then — lets Manual Addition browse timing beyond whatever
 * suggestTeachers happened to surface. Still requires the window to fall
 * within the child's own declared availability, same constraint
 * suggestTeachers enforces, so this only ever offers times legitimately open
 * to her; error explains why when it doesn't.
 */
// DB time columns come back "HH:MM:SS"; the picker only ever sends "HH:MM" (HourSelect has no
// seconds). Comparing those formats directly with <=/>= breaks on an exact-boundary match —
// "15:00:00" <= "15:00" is false as strings, even though the times are equal — so every
// DB-sourced time here is normalized to "HH:MM" before comparison.
function toHHMM(t: string): string {
  return t.slice(0, 5)
}

export async function findTeachersAtSlot(
  supabase: SupabaseClient<Database>,
  studentId: string,
  protocolId: string,
  slot: { dayOfWeek: number; startTime: string; endTime: string },
  weekStartDate: string = getUpcomingWeekStart()
): Promise<{ candidates: TimeSlotCandidate[]; error: string | null }> {
  const [{ data: studentWindows }, { data: neededRows }] = await Promise.all([
    supabase.from('student_availability').select('day_of_week, specific_date, start_time, end_time').eq('student_id', studentId),
    supabase.from('student_protocols').select('sub_protocol_id').eq('student_id', studentId).eq('protocol_id', protocolId),
  ])

  const withinDeclaredAvailability = (studentWindows ?? []).some((sw) => {
    const matchesRecurring = sw.day_of_week !== null && sw.day_of_week === slot.dayOfWeek
    const matchesSpecificDate = sw.specific_date !== null && sw.specific_date === dateForDayOfWeek(weekStartDate, slot.dayOfWeek)
    if (!matchesRecurring && !matchesSpecificDate) return false
    return toHHMM(sw.start_time) <= slot.startTime && slot.endTime <= toHHMM(sw.end_time)
  })
  if (!withinDeclaredAvailability) {
    return {
      candidates: [],
      error: "This child isn't marked available at that time — adjust her availability, or pick a different slot.",
    }
  }

  const neededSubProtocolIds = (neededRows ?? []).map((r) => r.sub_protocol_id).filter((id): id is string => id !== null)
  const qualifications = await getCoverageQualifications(supabase, protocolId, neededSubProtocolIds)
  if (qualifications.length === 0) return { candidates: [], error: null }

  const candidates: TimeSlotCandidate[] = []
  for (const qual of qualifications) {
    const [{ data: teacherWindows }, { data: conflicts }] = await Promise.all([
      supabase
        .from('teacher_availability')
        .select('day_of_week, start_time, end_time')
        .eq('teacher_id', qual.teacherId)
        .eq('week_start_date', weekStartDate),
      supabase
        .from('session_plans')
        .select('recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end')
        .eq('teacher_id', qual.teacherId)
        .in('status', ['pending', 'accepted']),
    ])

    const isFree = (teacherWindows ?? []).some(
      (tw) => tw.day_of_week === slot.dayOfWeek && toHHMM(tw.start_time) <= slot.startTime && slot.endTime <= toHHMM(tw.end_time)
    )
    if (!isFree) continue

    const conflictWindows = (conflicts ?? [])
      .map(conflictWindow)
      .filter((w): w is ConflictWindow => w !== null)
      .map((w) => ({ ...w, startTime: toHHMM(w.startTime), endTime: toHHMM(w.endTime) }))
    const candidateWindow: ConflictWindow = { dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime }
    const blocked = conflictWindows.some((c) => windowsOverlap(c, candidateWindow))
    if (blocked) continue

    const activeLoad = conflicts?.length ?? 0
    candidates.push({
      teacherId: qual.teacherId,
      teacherName: qual.teacherName,
      rating: qual.rating,
      coverageCount: qual.coverageCount,
      totalNeeded: qual.totalNeeded,
      activeLoad,
      scorePercent: matchScorePercent(qual.rating, activeLoad),
    })
  }

  candidates.sort((a, b) => b.coverageCount - a.coverageCount || b.rating - a.rating)
  return { candidates, error: null }
}
