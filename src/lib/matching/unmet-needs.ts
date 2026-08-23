import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { dateStringInBusinessTz } from '@/lib/timezone'

export interface UnmetNeed {
  studentId: string
  studentName: string
  protocolId: string
  protocolName: string
  /** All underlying student_protocols row ids folded into this one need — a protocol like
   *  Reflex Repatterning is one bookable session even when the child needs several of its
   *  sub-protocols, since one teacher addresses multiple sub-protocols in a single sitting. */
  needIds: string[]
  subProtocols: { id: string; name: string }[]
  parentPriorityTier: number
  /** Manually flagged from the Recommendation tab to jump the queue on the next Generate Schedule run. */
  prioritized: boolean
}

interface NeedRow {
  id: string
  student_id: string
  protocol_id: string
  sub_protocol_id: string | null
  students: {
    name: string
    status: string | null
    profiles: { priority_tier: number } | { priority_tier: number }[] | null
  } | null
  protocols: { title: string } | null
  sub_protocols: { title: string } | null
}

interface ActivePlanRow {
  student_id: string
  protocol_id: string
  recurrence_type: 'weekly' | 'one_off'
  start_time: string | null
}

/**
 * A student_protocols need "counts as covered" for weekStartDate's calendar month once there's
 * a pending/accepted/completed session for that (student, protocol) — see getUnmetNeeds for the
 * full recurrence rules. Shared so the Manual Addition picker can flag the same protocols as
 * already covered this month, not just the Generate Schedule flow.
 */
function buildActiveProtocolSet(activePlans: ActivePlanRow[], monthPrefix: string): Set<string> {
  const activeSet = new Set<string>()
  for (const p of activePlans) {
    const countsThisMonth =
      p.recurrence_type === 'weekly' || (p.start_time && dateStringInBusinessTz(new Date(p.start_time)).startsWith(monthPrefix))
    if (countsThisMonth) activeSet.add(`${p.student_id}:${p.protocol_id}`)
  }
  return activeSet
}

/**
 * Groups a student's protocol needs by (student, protocol) — a student_protocols row with
 * no pending/accepted/completed session that COUNTS FOR weekStartDate's calendar month means
 * the whole group is unmet. This intentionally counts a merely-booked (not yet completed)
 * session too — otherwise Generate Schedule would keep proposing duplicate sessions for a
 * protocol that's already on the books this week just because the teacher hasn't marked it
 * done yet. (Reports' monthly coverage is stricter — it requires 'completed' for a one-off
 * session — but that's a display/prioritization concern, not a booking-dedup one.) A
 * weekly-recurring session counts for every month it recurs through; a one-off session only
 * counts for its own month — so a protocol last booked in an earlier month reopens as unmet
 * once a new month starts, letting a student cycle through different protocols month to month
 * rather than one ever satisfying it permanently. Cancelling a session (or the month simply
 * moving on) reopens the group with no extra bookkeeping, since it just stops appearing in the
 * "active this month" set.
 */
export async function getUnmetNeeds(
  supabase: SupabaseClient<Database>,
  weekStartDate: string
): Promise<UnmetNeed[]> {
  const monthPrefix = weekStartDate.slice(0, 7)
  const [{ data: needs }, { data: activePlans }, { data: prioritizedRows }] = await Promise.all([
    supabase
      .from('student_protocols')
      .select(
        'id, student_id, protocol_id, sub_protocol_id, students(name, status, profiles!students_parent_id_fkey(priority_tier)), protocols(title), sub_protocols(title)'
      )
      .returns<NeedRow[]>(),
    supabase
      .from('session_plans')
      .select('student_id, protocol_id, recurrence_type, start_time')
      .in('status', ['pending', 'accepted', 'completed']),
    supabase.from('prioritized_needs').select('student_id, protocol_id'),
  ])

  const activeSet = buildActiveProtocolSet(activePlans ?? [], monthPrefix)
  const prioritizedSet = new Set((prioritizedRows ?? []).map((p) => `${p.student_id}:${p.protocol_id}`))

  const groups = new Map<string, UnmetNeed>()
  for (const n of needs ?? []) {
    if (n.students?.status === 'inactive') continue
    const key = `${n.student_id}:${n.protocol_id}`
    if (activeSet.has(key)) continue

    let group = groups.get(key)
    if (!group) {
      const profile = Array.isArray(n.students?.profiles) ? n.students?.profiles[0] : n.students?.profiles
      group = {
        studentId: n.student_id,
        studentName: n.students?.name ?? 'Unknown student',
        protocolId: n.protocol_id,
        protocolName: n.protocols?.title ?? 'Unknown protocol',
        needIds: [],
        subProtocols: [],
        parentPriorityTier: profile?.priority_tier ?? 0,
        prioritized: prioritizedSet.has(key),
      }
      groups.set(key, group)
    }

    group.needIds.push(n.id)
    if (n.sub_protocol_id && n.sub_protocols) {
      group.subProtocols.push({ id: n.sub_protocol_id, name: n.sub_protocols.title })
    }
  }

  const unmet = Array.from(groups.values())
  unmet.sort((a, b) => Number(b.prioritized) - Number(a.prioritized) || b.parentPriorityTier - a.parentPriorityTier)
  return unmet
}

export interface StudentProtocolOption {
  protocolId: string
  protocolName: string
  /** False once a pending/accepted/completed session already covers this (student, protocol)
   *  for weekStartDate's calendar month — same "counts as covered" rule as getUnmetNeeds. */
  available: boolean
  /** Set only when available is false — why it's disabled, for display next to the option. */
  reason: string | null
}

/**
 * For every student, her declared protocol needs (student_protocols) each flagged with whether
 * they're still open this calendar month or already covered by a booked session — lets Manual
 * Addition grey out a protocol the child already has a session for this month (e.g. Archetype
 * already scheduled this week) instead of silently allowing a duplicate, while resetting
 * automatically once a new month starts, same as the Generate Schedule flow.
 */
export async function getProtocolOptionsByStudent(
  supabase: SupabaseClient<Database>,
  weekStartDate: string
): Promise<Map<string, StudentProtocolOption[]>> {
  const monthPrefix = weekStartDate.slice(0, 7)
  const monthLabel = new Date(`${monthPrefix}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const [{ data: needs }, { data: activePlans }] = await Promise.all([
    supabase
      .from('student_protocols')
      .select('student_id, protocol_id, protocols(title)')
      .returns<{ student_id: string; protocol_id: string; protocols: { title: string } | null }[]>(),
    supabase
      .from('session_plans')
      .select('student_id, protocol_id, recurrence_type, start_time')
      .in('status', ['pending', 'accepted', 'completed'])
      .returns<ActivePlanRow[]>(),
  ])

  const activeSet = buildActiveProtocolSet(activePlans ?? [], monthPrefix)

  const byStudent = new Map<string, Map<string, StudentProtocolOption>>()
  for (const n of needs ?? []) {
    let protocolsForStudent = byStudent.get(n.student_id)
    if (!protocolsForStudent) {
      protocolsForStudent = new Map()
      byStudent.set(n.student_id, protocolsForStudent)
    }
    if (protocolsForStudent.has(n.protocol_id)) continue

    const isActive = activeSet.has(`${n.student_id}:${n.protocol_id}`)
    protocolsForStudent.set(n.protocol_id, {
      protocolId: n.protocol_id,
      protocolName: n.protocols?.title ?? 'Unknown protocol',
      available: !isActive,
      reason: isActive ? `Already scheduled this month (${monthLabel}) — reopens next month` : null,
    })
  }

  const result = new Map<string, StudentProtocolOption[]>()
  for (const [studentId, protocolsForStudent] of byStudent) {
    result.set(studentId, Array.from(protocolsForStudent.values()))
  }
  return result
}
