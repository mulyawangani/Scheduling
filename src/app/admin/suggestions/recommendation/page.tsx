import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { getUnmetNeeds } from '@/lib/matching/unmet-needs'
import { getRankingContext, rankNeeds, needKey, coverageRatioForRanking, type BestMatchInfo } from '@/lib/matching/rank-needs'
import { groupTeacherProtocolRows, coverageQualificationsFromGroup } from '@/lib/matching/suggest'
import { getUpcomingWeekStart } from '@/lib/week'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'
import { RecommendationList, type RankedNeed } from './recommendation-list'
import { SuggestionsNav } from '../suggestions-nav'

const cancelledDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TIMEZONE })

export default async function RecommendationPage() {
  const supabase = await createClient()

  const [rawNeeds, { rules, studentInfoById }, { data: sessionHistoryRows }, { data: allHistoryRows }] = await Promise.all([
    getUnmetNeeds(supabase, getUpcomingWeekStart()),
    getRankingContext(supabase),
    supabase
      .from('session_plans')
      .select('student_id, protocol_id, recurrence_type, start_time')
      .in('status', ['pending', 'accepted', 'completed']),
    // Every status, to find the most recent session_plans row per (student,
    // protocol) regardless of outcome — used below to detect "this need is
    // unmet because it was just cancelled," as opposed to never having been
    // scheduled or simply rolling over into a new month.
    supabase
      .from('session_plans')
      .select('student_id, protocol_id, teacher_id, status, responded_at, created_at')
      .order('created_at', { ascending: false }),
  ])

  // First row seen per key wins, since allHistoryRows is already newest-first.
  const mostRecentByNeed = new Map<string, { teacherId: string; status: string; respondedAt: string | null }>()
  for (const row of allHistoryRows ?? []) {
    const key = `${row.student_id}:${row.protocol_id}`
    if (!mostRecentByNeed.has(key)) {
      mostRecentByNeed.set(key, { teacherId: row.teacher_id, status: row.status, respondedAt: row.responded_at })
    }
  }

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

  const withCandidates: RankedNeed[] = ranked.map((need) => {
    const neededSubProtocolIds = need.subProtocols.map((sp) => sp.id)
    const totalNeeded = neededSubProtocolIds.length || 1
    const best = candidatesByNeed.get(needKey(need))?.[0] ?? null

    // Only surface a "same teacher" nudge when the LAST thing that happened
    // to this (student, protocol) pair was a cancellation — not when it's
    // simply never been scheduled, or rolled over from a completed month.
    // Also requires she still qualifies for the protocol today (teacherRowsByProtocol
    // reflects current teacher_protocols, not history), so a since-removed
    // teacher never gets recommended back.
    const lastOutcome = mostRecentByNeed.get(needKey(need))
    const previousTeacherName =
      lastOutcome?.status === 'cancelled' ? teacherRowsByProtocol.get(need.protocolId)?.get(lastOutcome.teacherId)?.teacherName : undefined
    const previousTeacher =
      lastOutcome?.status === 'cancelled' && previousTeacherName
        ? { teacherName: previousTeacherName, cancelledAt: lastOutcome.respondedAt ? cancelledDateFormatter.format(new Date(lastOutcome.respondedAt)) : null }
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

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Scheduling</h1>
      <SuggestionsNav active="/admin/suggestions/recommendation" />

      <p className="mb-4 text-sm text-gray-500">
        Every currently-unscheduled need, in the order your Rules say to tackle them next — this list refreshes
        itself automatically as needs get booked or new ones appear, so whatever&apos;s unscheduled this week is
        exactly what shows up here for next week too. For each one, the best teacher match is shown even if she
        doesn&apos;t fully cover it or isn&apos;t free yet — a starting point for stretching capacity when supply is
        short, before you decide to accept a partial match or wait.
      </p>

      {withCandidates.length === 0 ? (
        <p className="text-sm text-gray-500">No unmet needs right now.</p>
      ) : (
        <RecommendationList items={withCandidates} />
      )}

      {(() => {
        const prioritized = withCandidates.filter((item) => item.need.prioritized)
        if (prioritized.length === 0) return null
        return (
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-medium text-gray-700">Prioritized for next week ({prioritized.length})</h2>
            <p className="mb-3 text-xs text-gray-500">
              Flagged from the list above — Generate Schedule tries these before anything else, ahead of the normal
              Rules order, until they&apos;re booked or you un-prioritize them.
            </p>
            <RecommendationList items={prioritized} showRank={false} />
          </section>
        )
      })()}
    </main>
  )
}
