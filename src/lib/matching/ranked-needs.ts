import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { UnmetNeed } from './unmet-needs'
import { getUnmetNeeds } from './unmet-needs'
import { getRankingContext, rankNeeds, needKey, coverageRatioForRanking, type BestMatchInfo } from './rank-needs'
import { groupTeacherProtocolRows, coverageQualificationsFromGroup } from './suggest'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'

const cancelledDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TIMEZONE })

export interface RankedNeed {
  need: UnmetNeed
  priority: number
  rate: number
  /** Set when this need is unmet because its last session was cancelled or the teacher declined it — same teacher, so the owner can rebook her on a different day. */
  previousTeacher: { teacherName: string; outcome: 'cancelled' | 'declined'; reason: string | null; cancelledAt: string | null; respondedAtISO: string | null } | null
  bestCandidate: { teacherName: string; coverageCount: number; totalNeeded: number; rating: number } | null
}

/**
 * Every currently-unmet need, ranked per the owner's Rules, with the best
 * available teacher match and (if applicable) the reopened-by-cancellation
 * context attached — the full computation behind the Recommendation page.
 * Pulled out into its own function so /admin/suggestions/reschedule can reuse
 * the exact same "was this cancelled/declined" logic without a second,
 * potentially-diverging copy of it.
 */
export async function getRankedNeeds(supabase: SupabaseClient<Database>, weekStartDate: string): Promise<RankedNeed[]> {
  const [rawNeeds, { rules, studentInfoById }, { data: sessionHistoryRows }, { data: allHistoryRows }] = await Promise.all([
    getUnmetNeeds(supabase, weekStartDate),
    getRankingContext(supabase),
    supabase
      .from('session_plans')
      .select('student_id, protocol_id, recurrence_type, start_time')
      .in('status', ['pending', 'accepted', 'completed']),
    // Every status, to find the most recent session_plans row per (student,
    // protocol) regardless of outcome — used below to detect "this need is
    // unmet because it was just cancelled or declined," as opposed to never
    // having been scheduled or simply rolling over into a new month.
    supabase
      .from('session_plans')
      .select('id, student_id, protocol_id, teacher_id, status, responded_at, created_at')
      .order('created_at', { ascending: false }),
  ])

  // First row seen per key wins, since allHistoryRows is already newest-first.
  const mostRecentByNeed = new Map<string, { sessionId: string; teacherId: string; status: string; respondedAt: string | null }>()
  for (const row of allHistoryRows ?? []) {
    const key = `${row.student_id}:${row.protocol_id}`
    if (!mostRecentByNeed.has(key)) {
      mostRecentByNeed.set(key, { sessionId: row.id, teacherId: row.teacher_id, status: row.status, respondedAt: row.responded_at })
    }
  }

  // A teacher's decline records why on audit_log (see declineSession) —
  // pull those in so the reason can show alongside the nudge below instead
  // of the owner having to go digging for it.
  const declinedSessionIds = Array.from(mostRecentByNeed.values())
    .filter((v) => v.status === 'declined')
    .map((v) => v.sessionId)
  const { data: declineAuditRows } =
    declinedSessionIds.length > 0
      ? await supabase.from('audit_log').select('target_id, metadata').eq('action', 'decline_session').in('target_id', declinedSessionIds)
      : { data: [] }
  const declineReasonBySessionId = new Map(
    (declineAuditRows ?? []).map((r) => [r.target_id as string, (r.metadata as { reason?: string } | null)?.reason])
  )

  // Most recent one-off session date per (student, protocol), for the same
  // "hasn't had this protocol in a while" rotation tiebreak generateSchedule
  // uses — see the matching comment in generate-schedule.ts.
  const lastSeenByNeed = new Map<string, string>()
  for (const row of sessionHistoryRows ?? []) {
    if (row.recurrence_type !== 'one_off' || !row.start_time) continue
    const key = `${row.student_id}:${row.protocol_id}`
    const seenSoFar = lastSeenByNeed.get(key)
    if (!seenSoFar || row.start_time > seenSoFar) lastSeenByNeed.set(key, row.start_time)
  }

  // One bulk query for every teacher's qualifications across every protocol
  // these needs touch, instead of a per-need round-trip — also lets us
  // compute the best-available-teacher coverage/rating BEFORE ranking, so
  // the match_quality/teacher_rating factors can actually sort by it.
  const protocolIds = Array.from(new Set(rawNeeds.map((n) => n.protocolId)))
  const { data: teacherProtocolRows } =
    protocolIds.length > 0
      ? await supabase
          .from('teacher_protocols')
          .select('teacher_id, protocol_id, sub_protocol_id, rating, profiles!teacher_protocols_teacher_id_fkey(name)')
          .in('protocol_id', protocolIds)
      : { data: [] }
  const teacherRowsByProtocol = groupTeacherProtocolRows(
    (teacherProtocolRows ?? []).map((row) => ({
      teacher_id: row.teacher_id,
      protocol_id: row.protocol_id,
      sub_protocol_id: row.sub_protocol_id,
      rating: row.rating,
      teacherName: (Array.isArray(row.profiles) ? row.profiles[0]?.name : row.profiles?.name) ?? 'Unknown teacher',
    }))
  )

  const candidatesByNeed = new Map(
    rawNeeds.map((need) => {
      const neededSubProtocolIds = need.subProtocols.map((sp) => sp.id)
      return [needKey(need), coverageQualificationsFromGroup(teacherRowsByProtocol, need.protocolId, neededSubProtocolIds)]
    })
  )
  const bestMatchByNeed = new Map<string, BestMatchInfo>(
    rawNeeds.map((need) => {
      const totalNeeded = need.subProtocols.length || 1
      const best = candidatesByNeed.get(needKey(need))?.[0]
      return [
        needKey(need),
        { coverageRatio: best ? coverageRatioForRanking(best.coverageCount, totalNeeded, rules.match_quality_threshold) : 0, rating: best?.rating ?? 0 },
      ]
    })
  )

  const ranked = rankNeeds(rawNeeds, rules, studentInfoById, undefined, bestMatchByNeed, lastSeenByNeed)

  return ranked.map((need) => {
    const neededSubProtocolIds = need.subProtocols.map((sp) => sp.id)
    const totalNeeded = neededSubProtocolIds.length || 1
    const best = candidatesByNeed.get(needKey(need))?.[0] ?? null

    // Only surface a "same teacher" nudge when the LAST thing that happened
    // to this (student, protocol) pair was a cancellation or a teacher
    // decline — not when it's simply never been scheduled, or rolled over
    // from a completed month. Also requires she still qualifies for the
    // protocol today (teacherRowsByProtocol reflects current
    // teacher_protocols, not history), so a since-removed teacher never
    // gets recommended back.
    const lastOutcome = mostRecentByNeed.get(needKey(need))
    const isReopened = lastOutcome?.status === 'cancelled' || lastOutcome?.status === 'declined'
    const previousTeacherName = isReopened ? teacherRowsByProtocol.get(need.protocolId)?.get(lastOutcome.teacherId)?.teacherName : undefined
    const previousTeacher =
      isReopened && lastOutcome && previousTeacherName
        ? {
            teacherName: previousTeacherName,
            outcome: lastOutcome.status as 'cancelled' | 'declined',
            reason: lastOutcome.status === 'declined' ? (declineReasonBySessionId.get(lastOutcome.sessionId) ?? null) : null,
            cancelledAt: lastOutcome.respondedAt ? cancelledDateFormatter.format(new Date(lastOutcome.respondedAt)) : null,
            respondedAtISO: lastOutcome.respondedAt,
          }
        : null

    return {
      need,
      priority: studentInfoById.get(need.studentId)?.priority ?? 0,
      rate: studentInfoById.get(need.studentId)?.rate ?? 0,
      previousTeacher,
      bestCandidate: best
        ? { teacherName: best.teacherName, coverageCount: best.coverageCount, totalNeeded, rating: best.rating }
        : null,
    }
  })
}

/** True when this (student, protocol) pair's most recent session outcome was
 *  a cancellation or a teacher decline — the exact condition that puts it in
 *  the reopened list on both Recommendation and the admin Reschedule page. */
export function isReopenedNeed(item: RankedNeed): boolean {
  return item.previousTeacher !== null
}
