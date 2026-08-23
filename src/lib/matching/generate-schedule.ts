import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ServesScope, TeacherStatus } from '@/lib/supabase/types'
import { getUnmetNeeds, type UnmetNeed } from './unmet-needs'
import { conflictWindow, matchScorePercent, groupTeacherProtocolRows, coverageQualificationsFromGroup } from './suggest'
import { getRankingContext, rankNeeds, needKey, coverageRatioForRanking, type BestMatchInfo } from './rank-needs'
import { dateForDayOfWeek } from '@/lib/week'
import { dateStringInBusinessTz } from '@/lib/timezone'

const WEEKDAYS = [1, 2, 3, 4, 5] // Monday–Friday
const HOURS = Array.from({ length: 9 }, (_, i) => 8 + i) // 8:00 through 16:00 (last block ends 17:00)

export interface ProposedSession {
  studentId: string
  studentName: string
  protocolId: string
  protocolName: string
  teacherId: string
  teacherName: string
  date: string
  dayOfWeek: number
  startTime: string
  endTime: string
  matchScorePercent: number
  coverageCount: number
  totalNeeded: number
  prioritized: boolean
  /** Underlying student_protocols row ids for this need — lets the owner clear the need this proposal came from, same as "Clear" elsewhere. */
  needIds: string[]
}

export interface ExistingSessionForGrid {
  id: string
  teacherId: string
  studentId: string
  studentName: string
  teacherName: string
  protocolId: string
  protocolName: string
  date: string
  dayOfWeek: number
  startTime: string
  endTime: string
  // True when this session was already committed before a holiday got
  // declared on its date (or was placed there manually) — the algorithm
  // itself will never propose a new session on a holiday date.
  holidayConflict: boolean
}

export interface UnscheduledNeed {
  studentId: string
  studentName: string
  protocolName: string
  parentPriorityTier: number
  prioritized: boolean
}

export interface WeekHoliday {
  date: string
  name: string
  type: 'school' | 'public'
}

export interface GeneratedSchedule {
  weekStartDate: string
  proposals: ProposedSession[]
  existing: ExistingSessionForGrid[]
  unscheduled: UnscheduledNeed[]
  holidays: WeekHoliday[]
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`
}

function minutesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

interface DaySession {
  teacherId: string
  studentId: string
  startMin: number
  endMin: number
  teacherName: string
  studentName: string
  protocolName: string
}

/**
 * Greedily places every unmet need, ordered by the owner's configurable
 * scheduling_rules (student priority / rate / protocol needs, in whichever
 * order and direction she's set on the Rules tab), into a Mon–Fri slot
 * within the given week — respecting teacher/student availability, which
 * student status (student/non-student) each provider is scoped to serve, a
 * student's own weekly cap on distinct protocols (weekly_target_sessions),
 * no double-booking, owner-set teacher quotas, the max-concurrent-teachers
 * cap (waived for therapist-status providers), and center capacity rules —
 * all checked against both already-committed sessions and sessions this run
 * has already proposed. Nothing is written to the database; this only
 * produces a proposal for the owner to review and commit.
 */
export async function generateSchedule(
  supabase: SupabaseClient<Database>,
  weekStartDate: string
): Promise<GeneratedSchedule> {
  const [rawNeeds, { rules, studentInfoById }] = await Promise.all([
    getUnmetNeeds(supabase, weekStartDate),
    getRankingContext(supabase),
  ])
  const fridayDate = dateForDayOfWeek(weekStartDate, 5)

  const [
    { data: teacherProtocolRows },
    { data: teacherAvailabilityRows },
    { data: activeSessionRows },
    { data: capacityRules },
    { data: teacherConcurrencyRules },
    { data: teacherProfileRows },
    { data: studentAvailabilityRows },
    { data: holidayRows },
    { data: allStudentRows },
  ] = await Promise.all([
    supabase
      .from('teacher_protocols')
      .select('teacher_id, protocol_id, sub_protocol_id, rating, profiles!teacher_protocols_teacher_id_fkey(name)'),
    supabase
      .from('teacher_availability')
      .select('teacher_id, day_of_week, start_time, end_time')
      .eq('week_start_date', weekStartDate),
    supabase
      .from('session_plans')
      .select(
        'id, teacher_id, student_id, protocol_id, recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end, students(name), profiles!session_plans_teacher_id_fkey(name), protocols(title)'
      )
      .in('status', ['pending', 'accepted', 'completed']),
    supabase.from('capacity_rules').select('*'),
    supabase.from('teacher_concurrency_rules').select('*'),
    supabase.from('profiles').select('id, name, weekly_quota, daily_quota, status, serves_scope').eq('role', 'teacher'),
    supabase.from('student_availability').select('student_id, day_of_week, specific_date, start_time, end_time'),
    supabase.from('holidays').select('date, name, type').gte('date', weekStartDate).lte('date', fridayDate),
    supabase.from('students').select('id, name, weekly_target_sessions'),
  ])

  const teacherStatusById = new Map<string, TeacherStatus | null>((teacherProfileRows ?? []).map((t) => [t.id, t.status]))
  // Which student status (see students.status) each provider can be matched
  // to. An explicit serves_scope always wins; otherwise it's auto by status
  // — teachers serve students only, therapists serve non-students only, and
  // a provider with no status set is unrestricted. A student with no status
  // set isn't restricted by this either (there's nothing to check it against).
  const servesScopeById = new Map<string, ServesScope>(
    (teacherProfileRows ?? []).map((t) => [
      t.id,
      t.serves_scope ?? (t.status === 'teacher' ? 'student_only' : t.status === 'therapist' ? 'non_student_only' : 'both'),
    ])
  )

  const holidays: WeekHoliday[] = (holidayRows ?? []).map((h) => ({ date: h.date, name: h.name, type: h.type }))
  // Any holiday — school or public — blocks the algorithm from proposing a
  // session that date, for every child, regardless of status. The owner can
  // still manually assign a session on a holiday date if she chooses to
  // (manualAssign has no holiday check); this only restrains automatic
  // placement.
  const holidayDates = new Set(holidays.map((h) => h.date))

  const existing: ExistingSessionForGrid[] = []
  for (const row of activeSessionRows ?? []) {
    const window = conflictWindow(row)
    if (!window || !WEEKDAYS.includes(window.dayOfWeek)) continue

    const date = row.recurrence_type === 'weekly' ? dateForDayOfWeek(weekStartDate, window.dayOfWeek) : row.start_time ? dateStringInBusinessTz(new Date(row.start_time)) : null
    if (!date || date < weekStartDate || date > fridayDate) continue

    const studentName = (Array.isArray(row.students) ? row.students[0]?.name : row.students?.name) ?? 'Unknown student'
    const teacherName = (Array.isArray(row.profiles) ? row.profiles[0]?.name : row.profiles?.name) ?? 'Unknown teacher'
    const protocolName = (Array.isArray(row.protocols) ? row.protocols[0]?.title : row.protocols?.title) ?? 'Unknown protocol'

    existing.push({
      id: row.id,
      teacherId: row.teacher_id,
      studentId: row.student_id,
      studentName,
      teacherName,
      protocolId: row.protocol_id,
      protocolName,
      date,
      dayOfWeek: window.dayOfWeek,
      startTime: window.startTime,
      endTime: window.endTime,
      holidayConflict: holidayDates.has(date),
    })
  }

  // Caps how many DISTINCT protocols get a session for a given student in
  // this week (students.weekly_target_sessions) — combined with unmet needs
  // reopening monthly, this is what spreads a student's protocols across the
  // weeks of a month instead of repeating the same one. Seeded from already-
  // committed sessions this week; grows as this run places new proposals.
  const weeklyTargetByStudent = new Map<string, number | null>(
    (allStudentRows ?? []).map((s) => [s.id, s.weekly_target_sessions])
  )
  const distinctProtocolsThisWeekByStudent = new Map<string, Set<string>>()
  for (const e of existing) {
    const set = distinctProtocolsThisWeekByStudent.get(e.studentId) ?? new Set<string>()
    set.add(e.protocolId)
    distinctProtocolsThisWeekByStudent.set(e.studentId, set)
  }

  // Every status='student' student who'd otherwise end the week with fewer
  // than rules.weekly_minimum_sessions sessions gets her existing unmet
  // needs boosted to the front of the ranking (below explicit prioritized
  // stars) — this never invents a session for a protocol she doesn't need,
  // it just tries harder to place one of her real ones first while slots
  // are still open.
  const weeklySessionCountByStudent = new Map<string, number>()
  for (const e of existing) weeklySessionCountByStudent.set(e.studentId, (weeklySessionCountByStudent.get(e.studentId) ?? 0) + 1)
  const weeklyFloorBoostStudentIds = new Set<string>()
  if (rules.weekly_minimum_sessions > 0) {
    for (const [studentId, info] of studentInfoById) {
      if (info.status === 'student' && (weeklySessionCountByStudent.get(studentId) ?? 0) < rules.weekly_minimum_sessions) {
        weeklyFloorBoostStudentIds.add(studentId)
      }
    }
  }

  // Every student needs at least one session with rules.monthly_checkin_teacher_id
  // each calendar month (the month weekStartDate falls in) — but NOT via a
  // separate synthetic "protocol." Instead, one of the student's own real
  // unmet needs that this teacher is actually qualified for gets tried with
  // her FIRST (before anyone else); satisfied by ANY of her sessions with
  // the student that month, so a standing weekly session with her trivially
  // covers every month it recurs through. This both delivers a real
  // protocol and gets the student in front of her — see the per-need
  // isMonthlyCheckinCandidate check in the placement loop below.
  const checkinTeacherId = rules.monthly_checkin_teacher_id
  const gabyQualifiedProtocolIds = new Set(
    (teacherProtocolRows ?? []).filter((r) => r.teacher_id === checkinTeacherId).map((r) => r.protocol_id)
  )
  const monthCheckinSatisfiedStudentIds = new Set<string>()
  if (checkinTeacherId) {
    const monthPrefix = weekStartDate.slice(0, 7)
    for (const row of activeSessionRows ?? []) {
      if (row.teacher_id !== checkinTeacherId) continue
      if (row.recurrence_type === 'weekly') {
        monthCheckinSatisfiedStudentIds.add(row.student_id)
      } else if (row.start_time && dateStringInBusinessTz(new Date(row.start_time)).startsWith(monthPrefix)) {
        monthCheckinSatisfiedStudentIds.add(row.student_id)
      }
    }
  }

  // Per protocol, per teacher, her rating for each specific sub-protocol (or
  // '__protocol__' for a plain protocol-level row). A protocol like Reflex
  // Repatterning is booked as ONE session even when the child needs several
  // of its sub-protocols — a teacher works through whichever of them she's
  // qualified for in that single sitting — so qualification for a need-group
  // is "how many of the child's specific needed sub-protocols does she
  // cover," not just her best single rating for the protocol.
  const teacherRowsByProtocol = groupTeacherProtocolRows(
    (teacherProtocolRows ?? []).map((row) => ({
      teacher_id: row.teacher_id,
      protocol_id: row.protocol_id,
      sub_protocol_id: row.sub_protocol_id,
      rating: row.rating,
      teacherName: (Array.isArray(row.profiles) ? row.profiles[0]?.name : row.profiles?.name) ?? 'Unknown teacher',
    }))
  )
  const coverageCandidates = (protocolId: string, neededSubProtocolIds: string[]) =>
    coverageQualificationsFromGroup(teacherRowsByProtocol, protocolId, neededSubProtocolIds)

  // The best (highest-coverage, then highest-rated) qualified teacher for
  // each raw need, independent of her availability/load this week — feeds
  // the optional match_quality/teacher_rating ranking factors below, which
  // reflect how good a fit the protocol match itself is, not just who's
  // free right now (that's what the placement loop further down handles).
  const bestMatchByNeed = new Map<string, BestMatchInfo>(
    rawNeeds.map((need) => {
      const best = coverageCandidates(need.protocolId, need.subProtocols.map((sp) => sp.id))[0]
      const totalNeeded = need.subProtocols.length || 1
      return [
        needKey(need),
        { coverageRatio: best ? coverageRatioForRanking(best.coverageCount, totalNeeded, rules.match_quality_threshold) : 0, rating: best?.rating ?? 0 },
      ]
    })
  )

  // Most recent one-off session date per (student, protocol) — reused from
  // activeSessionRows, which already holds every pending/accepted/completed
  // session regardless of date, not just this week's. Feeds the rotation
  // tiebreak in rankNeeds: when a student's protocols are otherwise tied
  // (same priority, rate, match quality, rating — common, since most
  // protocols are equally well-staffed), the one she hasn't had in the
  // longest time wins, so her coverage actually rotates across her needs
  // instead of the same protocol winning every week on arbitrary row order.
  // Weekly-recurring coverage has no natural "last occurrence" to compare,
  // but a student with an active recurring session for a protocol never
  // reaches rankNeeds for it anyway (getUnmetNeeds excludes it), so this
  // only needs to handle one-off history.
  const lastSeenByNeed = new Map<string, string>()
  for (const row of activeSessionRows ?? []) {
    if (row.recurrence_type !== 'one_off' || !row.start_time) continue
    const key = `${row.student_id}:${row.protocol_id}`
    const seenSoFar = lastSeenByNeed.get(key)
    if (!seenSoFar || row.start_time > seenSoFar) lastSeenByNeed.set(key, row.start_time)
  }

  const needs = rankNeeds(rawNeeds, rules, studentInfoById, weeklyFloorBoostStudentIds, bestMatchByNeed, lastSeenByNeed)
  // Who the fairness floor (max_weekly_spread, below) is computed among:
  // status='teacher' providers (therapists are exempt from fairness
  // entirely) who have at least one protocol qualification. A teacher with
  // ZERO teacher_protocols rows can never be assigned anything, so she'd be
  // permanently stuck at 0 sessions — counting her as "least loaded" would
  // let her silently cap everyone else's capacity at max_weekly_spread
  // above her floor, even when they have real availability and quota left.
  const qualifiedTeacherIds = new Set((teacherProtocolRows ?? []).map((r) => r.teacher_id))
  const fairnessFloorTeacherIds = (teacherProfileRows ?? [])
    .filter((t) => t.status !== 'therapist' && qualifiedTeacherIds.has(t.id))
    .map((t) => t.id)

  const teacherAvailByTeacherDay = new Map<string, { start: number; end: number }[]>()
  for (const row of teacherAvailabilityRows ?? []) {
    if (!WEEKDAYS.includes(row.day_of_week)) continue
    const key = `${row.teacher_id}-${row.day_of_week}`
    const arr = teacherAvailByTeacherDay.get(key) ?? []
    arr.push({ start: timeToMinutes(row.start_time), end: timeToMinutes(row.end_time) })
    teacherAvailByTeacherDay.set(key, arr)
  }

  // Recurring (day_of_week) windows apply every week; specific_date windows
  // are additive on top of those for that one exact date only — a parent
  // can open up availability for a single upcoming date without it
  // recurring, since Generate Schedule works one week at a time anyway.
  const studentAvailByStudentDay = new Map<string, { start: number; end: number }[]>()
  const studentAvailByStudentDate = new Map<string, { start: number; end: number }[]>()
  for (const row of studentAvailabilityRows ?? []) {
    const window = { start: timeToMinutes(row.start_time), end: timeToMinutes(row.end_time) }
    if (row.specific_date) {
      const key = `${row.student_id}-${row.specific_date}`
      const arr = studentAvailByStudentDate.get(key) ?? []
      arr.push(window)
      studentAvailByStudentDate.set(key, arr)
    } else {
      const key = `${row.student_id}-${row.day_of_week}`
      const arr = studentAvailByStudentDay.get(key) ?? []
      arr.push(window)
      studentAvailByStudentDay.set(key, arr)
    }
  }

  const quotaByTeacher = new Map<string, { weekly: number | null; daily: number | null }>()
  for (const t of teacherProfileRows ?? []) {
    quotaByTeacher.set(t.id, { weekly: t.weekly_quota, daily: t.daily_quota })
  }

  const sessionsByDate = new Map<string, DaySession[]>()
  const weeklyCountByTeacher = new Map<string, number>()
  const dailyCountByTeacherDate = new Map<string, number>()
  for (const e of existing) {
    const arr = sessionsByDate.get(e.date) ?? []
    arr.push({
      teacherId: e.teacherId,
      studentId: e.studentId,
      startMin: timeToMinutes(e.startTime),
      endMin: timeToMinutes(e.endTime),
      teacherName: e.teacherName,
      studentName: e.studentName,
      protocolName: e.protocolName,
    })
    sessionsByDate.set(e.date, arr)
    weeklyCountByTeacher.set(e.teacherId, (weeklyCountByTeacher.get(e.teacherId) ?? 0) + 1)
    const dkey = `${e.teacherId}-${e.date}`
    dailyCountByTeacherDate.set(dkey, (dailyCountByTeacherDate.get(dkey) ?? 0) + 1)
  }

  function wouldExceedCapacity(date: string, startMin: number, endMin: number): boolean {
    const daySessions = sessionsByDate.get(date) ?? []
    for (const rule of capacityRules ?? []) {
      const ruleStart = timeToMinutes(rule.start_time)
      const ruleEnd = timeToMinutes(rule.end_time)
      const overlapStart = Math.max(startMin, ruleStart)
      const overlapEnd = Math.min(endMin, ruleEnd)
      if (overlapStart >= overlapEnd) continue
      for (let t = overlapStart; t < overlapEnd; t += 60) {
        const concurrent = daySessions.filter((s) => minutesOverlap(s.startMin, s.endMin, t, t + 60)).length + 1
        if (concurrent > rule.max_concurrent) return true
      }
    }
    return false
  }

  // Same as wouldExceedCapacity, but counted only among status='teacher'
  // providers (therapists are exempt from this room cap) and against
  // owner-configured time bands rather than a single flat number, so the
  // cap can differ by time of day (e.g. tighter during school hours).
  function wouldExceedTeacherCap(date: string, startMin: number, endMin: number): boolean {
    const daySessions = (sessionsByDate.get(date) ?? []).filter((s) => teacherStatusById.get(s.teacherId) !== 'therapist')
    for (const rule of teacherConcurrencyRules ?? []) {
      const ruleStart = timeToMinutes(rule.start_time)
      const ruleEnd = timeToMinutes(rule.end_time)
      const overlapStart = Math.max(startMin, ruleStart)
      const overlapEnd = Math.min(endMin, ruleEnd)
      if (overlapStart >= overlapEnd) continue
      for (let t = overlapStart; t < overlapEnd; t += 60) {
        const concurrent = daySessions.filter((s) => minutesOverlap(s.startMin, s.endMin, t, t + 60)).length + 1
        if (concurrent > rule.max_concurrent) return true
      }
    }
    return false
  }

  const proposals: ProposedSession[] = []
  const unscheduled: UnscheduledNeed[] = []

  type Qual = { teacherId: string; teacherName: string; rating: number; coverageCount: number; totalNeeded: number }

  /** Tries every candidate in `quals` (already sorted best-first) across the whole week; mutates state and returns whether it placed. */
  function tryPlace(need: UnmetNeed, quals: Qual[]): boolean {
    for (const qual of quals) {
      const quota = quotaByTeacher.get(qual.teacherId) ?? { weekly: null, daily: null }
      // Therapists are still exempt from the room cap (wouldExceedTeacherCap)
      // and the fairness spread below, but — like teachers — they're now
      // bound to their uploaded availability window before quota is checked.
      const isTherapist = teacherStatusById.get(qual.teacherId) === 'therapist'

      const scope = servesScopeById.get(qual.teacherId) ?? 'both'
      const studentStatus = studentInfoById.get(need.studentId)?.status ?? null
      if (studentStatus && scope !== 'both') {
        if (scope === 'student_only' && studentStatus !== 'student') continue
        if (scope === 'non_student_only' && studentStatus !== 'non_student') continue
      }

      for (const day of WEEKDAYS) {
        const date = dateForDayOfWeek(weekStartDate, day)
        if (holidayDates.has(date)) continue
        const teacherWindows = teacherAvailByTeacherDay.get(`${qual.teacherId}-${day}`) ?? []
        const studentWindows = [
          ...(studentAvailByStudentDay.get(`${need.studentId}-${day}`) ?? []),
          ...(studentAvailByStudentDate.get(`${need.studentId}-${date}`) ?? []),
        ]
        if (teacherWindows.length === 0 || studentWindows.length === 0) continue

        for (const hour of HOURS) {
          const slotStart = hour * 60
          const slotEnd = slotStart + 60

          const teacherOk = teacherWindows.some((w) => w.start <= slotStart && slotEnd <= w.end)
          const studentOk = studentWindows.some((w) => w.start <= slotStart && slotEnd <= w.end)
          if (!teacherOk || !studentOk) continue

          const daySessions = sessionsByDate.get(date) ?? []
          const teacherBusy = daySessions.some((s) => s.teacherId === qual.teacherId && minutesOverlap(s.startMin, s.endMin, slotStart, slotEnd))
          const studentBusy = daySessions.some((s) => s.studentId === need.studentId && minutesOverlap(s.startMin, s.endMin, slotStart, slotEnd))
          if (teacherBusy || studentBusy) continue

          // Owner-configurable, independently for student and teacher: no two
          // sessions with zero gap between them that day — e.g. 15:00-16:00
          // immediately followed by 16:00-17:00. Checked against both
          // already-committed sessions and ones this run has already
          // proposed, same as {student,teacher}Busy above. Doesn't apply to
          // Manual Addition (an explicit owner override, unconstrained by Rules).
          // The student-side rule only binds status='student' children —
          // non_student (and unset-status) children are exempt, same scoping
          // convention as weekly_minimum_sessions above.
          if (rules.no_back_to_back_enabled && studentStatus === 'student') {
            const studentAdjacent = daySessions.some(
              (s) => s.studentId === need.studentId && (s.endMin === slotStart || s.startMin === slotEnd)
            )
            if (studentAdjacent) continue
          }
          if (rules.no_back_to_back_teacher_enabled) {
            const teacherAdjacent = daySessions.some(
              (s) => s.teacherId === qual.teacherId && (s.endMin === slotStart || s.startMin === slotEnd)
            )
            if (teacherAdjacent) continue
          }

          const weeklyCount = weeklyCountByTeacher.get(qual.teacherId) ?? 0
          const dailyCount = dailyCountByTeacherDate.get(`${qual.teacherId}-${date}`) ?? 0
          if (quota.weekly !== null && weeklyCount + 1 > quota.weekly) continue
          if (quota.daily !== null && dailyCount + 1 > quota.daily) continue

          if (wouldExceedCapacity(date, slotStart, slotEnd)) continue

          if (!isTherapist && wouldExceedTeacherCap(date, slotStart, slotEnd)) continue

          if (!isTherapist && fairnessFloorTeacherIds.length > 0) {
            const minWeeklyAmongTeachers = Math.min(...fairnessFloorTeacherIds.map((id) => weeklyCountByTeacher.get(id) ?? 0))
            if (weeklyCount + 1 - minWeeklyAmongTeachers > rules.max_weekly_spread) continue
          }

          proposals.push({
            studentId: need.studentId,
            studentName: need.studentName,
            protocolId: need.protocolId,
            protocolName: need.protocolName,
            teacherId: qual.teacherId,
            teacherName: qual.teacherName,
            date,
            dayOfWeek: day,
            startTime: minutesToTime(slotStart),
            endTime: minutesToTime(slotEnd),
            matchScorePercent: matchScorePercent(qual.rating, weeklyCount),
            coverageCount: qual.coverageCount,
            totalNeeded: qual.totalNeeded,
            prioritized: need.prioritized,
            needIds: need.needIds,
          })

          const arr = sessionsByDate.get(date) ?? []
          arr.push({
            teacherId: qual.teacherId,
            studentId: need.studentId,
            startMin: slotStart,
            endMin: slotEnd,
            teacherName: qual.teacherName,
            studentName: need.studentName,
            protocolName: need.protocolName,
          })
          sessionsByDate.set(date, arr)
          weeklyCountByTeacher.set(qual.teacherId, weeklyCount + 1)
          dailyCountByTeacherDate.set(`${qual.teacherId}-${date}`, dailyCount + 1)
          const distinctSet = distinctProtocolsThisWeekByStudent.get(need.studentId) ?? new Set<string>()
          distinctSet.add(need.protocolId)
          distinctProtocolsThisWeekByStudent.set(need.studentId, distinctSet)

          return true
        }
      }
    }
    return false
  }

  for (const need of needs) {
    // A student's weekly_target_sessions caps how many DISTINCT protocols
    // she gets this week — once she's at the cap, a need for a protocol not
    // already among them stays unscheduled this week (it'll be attempted
    // again next week, or sooner if the owner prioritizes it from Reports).
    const target = weeklyTargetByStudent.get(need.studentId)
    const distinctSoFar = distinctProtocolsThisWeekByStudent.get(need.studentId) ?? new Set<string>()
    if (target != null && !distinctSoFar.has(need.protocolId) && distinctSoFar.size >= target) {
      unscheduled.push({
        studentId: need.studentId,
        studentName: need.studentName,
        protocolName: need.protocolName,
        parentPriorityTier: need.parentPriorityTier,
        prioritized: need.prioritized,
      })
      continue
    }

    const neededSubProtocolIds = need.subProtocols.map((sp) => sp.id)
    // Coverage always wins first (a partial match shouldn't lose to a full
    // one just because its teacher is busier). Below that, load beats rating:
    // among teachers (therapists are exempt, same as the fairness cap below)
    // covering the need equally well, the one with fewer sessions so far
    // THIS RUN goes first. Since weeklyCountByTeacher updates live as
    // proposals get placed, this is self-correcting — an underloaded teacher
    // (e.g. one with few protocol qualifications) gets first pick of every
    // need she's qualified for until her load catches up, then rating
    // resumes deciding ties. Rating only tiebreaks equal-load candidates.
    const allQuals = coverageCandidates(need.protocolId, neededSubProtocolIds).sort((a, b) => {
      if (b.coverageCount !== a.coverageCount) return b.coverageCount - a.coverageCount
      const aIsTherapist = teacherStatusById.get(a.teacherId) === 'therapist'
      const bIsTherapist = teacherStatusById.get(b.teacherId) === 'therapist'
      if (!aIsTherapist && !bIsTherapist) {
        const aLoad = weeklyCountByTeacher.get(a.teacherId) ?? 0
        const bLoad = weeklyCountByTeacher.get(b.teacherId) ?? 0
        if (aLoad !== bLoad) return aLoad - bLoad
      }
      return b.rating - a.rating
    })

    let placed = false

    // Manual owner override: if a teacher is flagged as prioritized on the
    // Rules tab, she's tried — and only her — first for every need she's
    // qualified for, ahead of even the monthly check-in teacher. This is the
    // explicit lever for catching a specific teacher up (e.g. she's fallen
    // behind on workload); falls back to the normal order below if she has
    // no room, so the need still gets picked up by someone else.
    if (rules.prioritized_teacher_id) {
      const prioritizedQual = allQuals.find((q) => q.teacherId === rules.prioritized_teacher_id)
      if (prioritizedQual) placed = tryPlace(need, [prioritizedQual])
    }

    // If this student hasn't seen the monthly check-in teacher yet this
    // month and she's actually qualified for this particular protocol, try
    // her — and only her — next, so a real session lands with her
    // specifically rather than whoever's most convenient. Falls back to the
    // normal candidate order below if she genuinely has no room this week,
    // so the protocol still gets delivered by someone (just not
    // check-in-satisfying) rather than failing outright.
    const isMonthlyCheckinCandidate =
      !!checkinTeacherId && !monthCheckinSatisfiedStudentIds.has(need.studentId) && gabyQualifiedProtocolIds.has(need.protocolId)
    if (!placed && isMonthlyCheckinCandidate) {
      const checkinQual = allQuals.find((q) => q.teacherId === checkinTeacherId)
      if (checkinQual) placed = tryPlace(need, [checkinQual])
    }

    // Whichever path placed it, credit the monthly check-in if the teacher
    // who actually got the session happens to be her — a student prioritized
    // straight to the check-in teacher shouldn't get a redundant session with
    // her again later this month.
    if (placed && proposals[proposals.length - 1]?.teacherId === checkinTeacherId) {
      monthCheckinSatisfiedStudentIds.add(need.studentId)
    }

    if (!placed) placed = tryPlace(need, allQuals)

    if (!placed) {
      unscheduled.push({
        studentId: need.studentId,
        studentName: need.studentName,
        protocolName: need.protocolName,
        parentPriorityTier: need.parentPriorityTier,
        prioritized: need.prioritized,
      })
    }
  }

  return { weekStartDate, proposals, existing, unscheduled, holidays }
}
