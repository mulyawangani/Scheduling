import type { GeneratedSchedule } from './generate-schedule'
import { dateForDayOfWeek } from '@/lib/week'

export type NoSessionReason =
  /** Has no protocol needs at all, so there is nothing for the scheduler to ever place. */
  | 'no_needs'
  /** Has needs but no availability windows at all, so no slot can ever fit. */
  | 'no_availability'
  /** Has availability windows, but none that fall in this week (e.g. only one-time dates already past). */
  | 'availability_outside_week'
  /** Needs are unmet and no teacher/slot fits this week. */
  | 'unplaceable'
  /** The scheduler can place something this week — it just hasn't been booked yet. */
  | 'proposed'
  /** Every protocol already has a session this month (monthly reopening), so nothing is due. */
  | 'covered'

export interface NoSessionChild {
  studentId: string
  studentName: string
  parentName: string | null
  reason: NoSessionReason
  /** Short detail for the reason, e.g. which protocols couldn't be placed. */
  detail: string | null
}

export interface StudentForReport {
  id: string
  name: string
  /** Whether therapy is switched on for the child; a child with therapy off is not expected to have sessions. */
  therapyOn: boolean
  parentName: string | null
}

export interface AvailabilityWindow {
  dayOfWeek: number | null
  specificDate: string | null
}

/**
 * Every child with therapy switched on and no session at all in the schedule's week, and why.
 * The point is that a child can never again be silently absent: before this,
 * a child the scheduler couldn't see (or had nothing to place for) appeared in
 * no list anywhere, so nobody was told they'd go a whole week with no session.
 */
export function buildNoSessionReport(args: {
  students: StudentForReport[]
  studentIdsWithNeeds: Set<string>
  availabilityByStudent: Map<string, AvailabilityWindow[]>
  schedule: Pick<GeneratedSchedule, 'weekStartDate' | 'existing' | 'proposals' | 'unscheduled'>
}): NoSessionChild[] {
  const { students, studentIdsWithNeeds, availabilityByStudent, schedule } = args
  const weekStart = schedule.weekStartDate
  const weekEnd = dateForDayOfWeek(weekStart, 5) // the scheduler only places Mon–Fri

  const hasSession = new Set(schedule.existing.map((e) => e.studentId))
  const proposedByStudent = new Map<string, string[]>()
  for (const p of schedule.proposals) {
    const list = proposedByStudent.get(p.studentId) ?? []
    list.push(p.protocolName)
    proposedByStudent.set(p.studentId, list)
  }
  const unplacedByStudent = new Map<string, string[]>()
  for (const u of schedule.unscheduled) {
    const list = unplacedByStudent.get(u.studentId) ?? []
    list.push(u.protocolName)
    unplacedByStudent.set(u.studentId, list)
  }

  const out: NoSessionChild[] = []
  for (const s of students) {
    if (!s.therapyOn || hasSession.has(s.id)) continue

    const base = { studentId: s.id, studentName: s.name, parentName: s.parentName }
    const windows = availabilityByStudent.get(s.id) ?? []
    const usableThisWeek = windows.some((w) =>
      w.specificDate ? w.specificDate >= weekStart && w.specificDate <= weekEnd : w.dayOfWeek !== null && w.dayOfWeek >= 1 && w.dayOfWeek <= 5
    )
    const proposed = proposedByStudent.get(s.id)
    const unplaced = unplacedByStudent.get(s.id)

    if (!studentIdsWithNeeds.has(s.id)) {
      out.push({ ...base, reason: 'no_needs', detail: null })
    } else if (windows.length === 0) {
      out.push({ ...base, reason: 'no_availability', detail: null })
    } else if (!usableThisWeek) {
      out.push({ ...base, reason: 'availability_outside_week', detail: null })
    } else if (proposed?.length) {
      out.push({ ...base, reason: 'proposed', detail: Array.from(new Set(proposed)).join(', ') })
    } else if (unplaced?.length) {
      out.push({ ...base, reason: 'unplaceable', detail: Array.from(new Set(unplaced)).join(', ') })
    } else {
      out.push({ ...base, reason: 'covered', detail: null })
    }
  }

  return out.sort((a, b) => a.studentName.localeCompare(b.studentName))
}
