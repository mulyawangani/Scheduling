'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { RankFactor, SortDirection } from '@/lib/supabase/types'

const FACTORS: RankFactor[] = ['priority', 'rate', 'protocol_needs', 'match_quality', 'teacher_rating']
const DIRECTIONS: SortDirection[] = ['asc', 'desc']

export async function updateSchedulingRules(formData: FormData) {
  const rankOrder = formData.getAll('rank_order').map(String)
  const priorityDirection = String(formData.get('priority_direction') || '')
  const rateDirection = String(formData.get('rate_direction') || '')
  const protocolNeedsDirection = String(formData.get('protocol_needs_direction') || '')
  const matchQualityDirection = String(formData.get('match_quality_direction') || '')
  const teacherRatingDirection = String(formData.get('teacher_rating_direction') || '')
  const matchQualityThreshold = Number(formData.get('match_quality_threshold') || 0)
  const weeklyMinimumSessions = Number(formData.get('weekly_minimum_sessions') || 0)
  const maxWeeklySpread = Number(formData.get('max_weekly_spread') || 0)
  const priorityEnabled = formData.get('priority_enabled') === 'true'
  const rateEnabled = formData.get('rate_enabled') === 'true'
  const protocolNeedsEnabled = formData.get('protocol_needs_enabled') === 'true'
  const matchQualityEnabled = formData.get('match_quality_enabled') === 'true'
  const teacherRatingEnabled = formData.get('teacher_rating_enabled') === 'true'
  const noBackToBackEnabled = formData.get('no_back_to_back_enabled') === 'true'
  const noBackToBackTeacherEnabled = formData.get('no_back_to_back_teacher_enabled') === 'true'

  if (!rankOrder.every((r): r is RankFactor => FACTORS.includes(r as RankFactor)) || new Set(rankOrder).size !== FACTORS.length) {
    return { error: 'Ranking must include each factor exactly once.' }
  }
  const directions = [priorityDirection, rateDirection, protocolNeedsDirection, matchQualityDirection, teacherRatingDirection]
  if (!directions.every((d) => DIRECTIONS.includes(d as SortDirection))) {
    return { error: 'Invalid sort direction.' }
  }
  if (!Number.isFinite(weeklyMinimumSessions) || weeklyMinimumSessions < 0) {
    return { error: 'Weekly minimum sessions must be 0 or more.' }
  }
  if (!Number.isFinite(maxWeeklySpread) || maxWeeklySpread < 0) {
    return { error: 'Max weekly spread must be 0 or more.' }
  }
  if (!Number.isFinite(matchQualityThreshold) || matchQualityThreshold < 0 || matchQualityThreshold > 100) {
    return { error: 'Match quality threshold must be between 0 and 100.' }
  }

  const monthlyCheckinTeacherId = String(formData.get('monthly_checkin_teacher_id') || '') || null
  const prioritizedTeacherId = String(formData.get('prioritized_teacher_id') || '') || null
  const prioritizedProtocolId = String(formData.get('prioritized_protocol_id') || '') || null

  const supabase = await createClient()

  const { error } = await supabase
    .from('scheduling_rules')
    .update({
      rank_order: rankOrder as RankFactor[],
      priority_direction: priorityDirection as SortDirection,
      rate_direction: rateDirection as SortDirection,
      protocol_needs_direction: protocolNeedsDirection as SortDirection,
      match_quality_direction: matchQualityDirection as SortDirection,
      teacher_rating_direction: teacherRatingDirection as SortDirection,
      match_quality_threshold: matchQualityThreshold,
      priority_enabled: priorityEnabled,
      rate_enabled: rateEnabled,
      protocol_needs_enabled: protocolNeedsEnabled,
      match_quality_enabled: matchQualityEnabled,
      teacher_rating_enabled: teacherRatingEnabled,
      weekly_minimum_sessions: weeklyMinimumSessions,
      max_weekly_spread: maxWeeklySpread,
      monthly_checkin_teacher_id: monthlyCheckinTeacherId,
      prioritized_teacher_id: prioritizedTeacherId,
      prioritized_protocol_id: prioritizedProtocolId,
      no_back_to_back_enabled: noBackToBackEnabled,
      no_back_to_back_teacher_enabled: noBackToBackTeacherEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true)

  if (error) return { error: 'Could not save rules.' }

  revalidatePath('/admin/suggestions/rules')
  revalidatePath('/admin/suggestions')
  return { error: null }
}

export async function createTeacherConcurrencyRule(formData: FormData) {
  const startTime = String(formData.get('startTime') || '')
  const endTime = String(formData.get('endTime') || '')
  const maxConcurrent = Number(formData.get('maxConcurrent') || 0)

  if (!startTime || !endTime) return { error: 'Start and end time are required.' }
  if (startTime >= endTime) return { error: 'End time must be after start time.' }
  if (!Number.isFinite(maxConcurrent) || maxConcurrent < 1) return { error: 'Max concurrent must be at least 1.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('teacher_concurrency_rules')
    .insert({ start_time: startTime, end_time: endTime, max_concurrent: maxConcurrent })

  if (error) return { error: 'Could not create rule.' }

  revalidatePath('/admin/suggestions/rules')
  return { error: null }
}

export async function deleteTeacherConcurrencyRule(ruleId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('teacher_concurrency_rules').delete().eq('id', ruleId)

  if (error) return { error: 'Could not remove rule.' }

  revalidatePath('/admin/suggestions/rules')
  return { error: null }
}
