import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, RankFactor, SchedulingRules, SortDirection, StudentStatus } from '@/lib/supabase/types'
import type { UnmetNeed } from './unmet-needs'

export const DEFAULT_SCHEDULING_RULES: SchedulingRules = {
  id: true,
  rank_order: ['priority', 'rate', 'protocol_needs', 'match_quality', 'teacher_rating'],
  priority_direction: 'asc', // priority is 1=High/2=Medium/3=Low, so ascending means high-priority first
  rate_direction: 'desc',
  protocol_needs_direction: 'desc',
  match_quality_direction: 'desc',
  teacher_rating_direction: 'desc',
  match_quality_threshold: 50,
  priority_enabled: true,
  rate_enabled: true,
  protocol_needs_enabled: true,
  match_quality_enabled: true,
  teacher_rating_enabled: true,
  weekly_minimum_sessions: 1,
  max_weekly_spread: 2,
  monthly_checkin_teacher_id: null,
  prioritized_teacher_id: null,
  prioritized_protocol_id: null,
  no_back_to_back_enabled: false,
  no_back_to_back_teacher_enabled: false,
  updated_at: '',
}

export interface StudentRankInfo {
  priority: number
  rate: number
  status: StudentStatus | null
}

/** `${studentId}:${protocolId}` — same key convention as unmet-needs.ts's internal grouping. */
export function needKey(need: Pick<UnmetNeed, 'studentId' | 'protocolId'>): string {
  return `${need.studentId}:${need.protocolId}`
}

export interface BestMatchInfo {
  /** 0–1: how much of this need's required sub-protocols the best available teacher actually covers (1 for a protocol with no sub-items and any qualified teacher). */
  coverageRatio: number
  /** That same best-available teacher's rating (1–5) for this protocol/sub-protocol set. 0 if nobody is qualified at all. */
  rating: number
}

// Generate Schedule books a protocol as ONE session no matter how many of
// its sub-protocols the child needs — so a teacher covering most of them is,
// for scheduling purposes, a full match, same as a protocol with no
// sub-items at all (whose coverage is trivially 1 the moment anyone
// qualifies). Without this clamp, a protocol like Reflex Repatterning —
// where genuine coverage is almost always partial (few teachers cover all
// 20+ sub-protocols a child needs) — would always rank below every
// sub-item-free protocol's automatic 1.0, regardless of how thorough the
// actual match is. Owner-configurable (match_quality_threshold, 0-100); this
// is only the fallback for when scheduling_rules hasn't loaded yet.
const DEFAULT_FULL_MATCH_COVERAGE_THRESHOLD_PERCENT = 50

/** Coverage ratio for ranking (match_quality) — see the threshold comment above. thresholdPercent is 0-100. */
export function coverageRatioForRanking(
  coverageCount: number,
  totalNeeded: number,
  thresholdPercent: number = DEFAULT_FULL_MATCH_COVERAGE_THRESHOLD_PERCENT
): number {
  const raw = totalNeeded > 0 ? coverageCount / totalNeeded : 0
  return raw >= thresholdPercent / 100 ? 1 : raw
}

function needFactorValue(
  need: UnmetNeed,
  factor: RankFactor,
  studentInfoById: Map<string, StudentRankInfo>,
  bestMatchByNeed: Map<string, BestMatchInfo> | undefined
): number {
  if (factor === 'priority') return studentInfoById.get(need.studentId)?.priority ?? 0
  if (factor === 'rate') return studentInfoById.get(need.studentId)?.rate ?? 0
  if (factor === 'protocol_needs') return need.subProtocols.length || 1
  const bestMatch = bestMatchByNeed?.get(needKey(need))
  if (factor === 'match_quality') return bestMatch?.coverageRatio ?? 0
  return bestMatch?.rating ?? 0 // teacher_rating
}

/** Fetches the owner's scheduling_rules row (falling back to defaults) and the per-student ranking inputs it needs. */
export async function getRankingContext(
  supabase: SupabaseClient<Database>
): Promise<{ rules: SchedulingRules; studentInfoById: Map<string, StudentRankInfo> }> {
  const [{ data: rulesRow }, { data: studentInfoRows }] = await Promise.all([
    supabase.from('scheduling_rules').select('*').eq('id', true).single(),
    supabase.from('students').select('id, priority, rate_per_session, status'),
  ])
  const rules = rulesRow ?? DEFAULT_SCHEDULING_RULES
  const studentInfoById = new Map(
    (studentInfoRows ?? []).map((s) => [s.id, { priority: s.priority ?? 0, rate: s.rate_per_session ?? 0, status: s.status }])
  )
  return { rules, studentInfoById }
}

/**
 * Orders needs by the owner's configurable Generate Schedule priority — a
 * reorderable, individually-toggleable list of factors set on the Rules tab
 * (student priority / session rate / sub-protocol count / how well the best
 * available teacher's capability actually covers this need / that teacher's
 * capability rating) — the same order Generate Schedule attempts needs in,
 * so this is what the Recommendation tab uses to say what to tackle first,
 * too. match_quality and teacher_rating need `bestMatchByNeed` (the best
 * qualified teacher's coverage/rating for each need, from
 * suggest.ts's coverageQualificationsFromGroup) — omitted, they score 0 and
 * effectively no-op. Mutates nothing; returns a new sorted array.
 */
export function rankNeeds(
  needs: UnmetNeed[],
  rules: SchedulingRules,
  studentInfoById: Map<string, StudentRankInfo>,
  weeklyFloorBoostStudentIds?: Set<string>,
  bestMatchByNeed?: Map<string, BestMatchInfo>,
  /** `needKey` -> most recent one-off session date (ISO string) for that (student, protocol). Missing = never seen. */
  lastSeenByNeed?: Map<string, string>
): UnmetNeed[] {
  const directionByFactor: Record<RankFactor, SortDirection> = {
    priority: rules.priority_direction,
    rate: rules.rate_direction,
    protocol_needs: rules.protocol_needs_direction,
    match_quality: rules.match_quality_direction,
    teacher_rating: rules.teacher_rating_direction,
  }
  const enabledByFactor: Record<RankFactor, boolean> = {
    priority: rules.priority_enabled,
    rate: rules.rate_enabled,
    protocol_needs: rules.protocol_needs_enabled,
    match_quality: rules.match_quality_enabled,
    teacher_rating: rules.teacher_rating_enabled,
  }
  return [...needs].sort((a, b) => {
    if (a.prioritized !== b.prioritized) return Number(b.prioritized) - Number(a.prioritized)
    if (weeklyFloorBoostStudentIds) {
      const aBoost = weeklyFloorBoostStudentIds.has(a.studentId)
      const bBoost = weeklyFloorBoostStudentIds.has(b.studentId)
      if (aBoost !== bBoost) return Number(bBoost) - Number(aBoost)
    }
    // When a student has several different unmet protocols competing for her
    // limited weekly_target_sessions slots, this owner-picked protocol wins
    // the slot over her other needs — same idea as prioritized-teacher, but
    // for which protocol gets attempted first rather than who attempts it.
    if (rules.prioritized_protocol_id) {
      const aIsPrioritized = a.protocolId === rules.prioritized_protocol_id
      const bIsPrioritized = b.protocolId === rules.prioritized_protocol_id
      if (aIsPrioritized !== bIsPrioritized) return Number(bIsPrioritized) - Number(aIsPrioritized)
    }
    for (const factor of rules.rank_order) {
      if (!enabledByFactor[factor]) continue
      const av = needFactorValue(a, factor, studentInfoById, bestMatchByNeed)
      const bv = needFactorValue(b, factor, studentInfoById, bestMatchByNeed)
      if (av !== bv) return directionByFactor[factor] === 'desc' ? bv - av : av - bv
    }
    // Final tiebreak, same-student only: once every configured factor above
    // ties completely — common, since most of a child's protocols are
    // equally well-staffed — favor whichever protocol she hasn't had a
    // session for in the longest time (never = earliest possible), so her
    // coverage rotates across her different needs instead of one protocol
    // winning by arbitrary database row order every single week. Comparing
    // "overdue-ness" only makes sense within the same student — it says
    // nothing about ranking one student's needs against another's.
    if (a.studentId === b.studentId && lastSeenByNeed) {
      const aLastSeen = lastSeenByNeed.get(needKey(a)) ?? ''
      const bLastSeen = lastSeenByNeed.get(needKey(b)) ?? ''
      if (aLastSeen !== bLastSeen) return aLastSeen < bLastSeen ? -1 : 1
    }
    return 0
  })
}
