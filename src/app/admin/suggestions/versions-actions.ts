'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ProposedSession, UnscheduledNeed } from '@/lib/matching/generate-schedule'

export async function saveScheduleVersion(
  weekStartDate: string,
  proposals: ProposedSession[],
  unscheduled: UnscheduledNeed[],
  scheduledCount: number
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const { count } = await supabase
    .from('schedule_versions')
    .select('id', { count: 'exact', head: true })
    .eq('week_start_date', weekStartDate)

  const label = `v${(count ?? 0) + 1}`

  const { error } = await supabase.from('schedule_versions').insert({
    week_start_date: weekStartDate,
    label,
    proposals,
    unscheduled,
    scheduled_count: scheduledCount,
    created_by: user.id,
  })

  if (error) return { error: 'Could not save version.' }

  revalidatePath('/admin/suggestions')
  return { error: null }
}

export async function deleteScheduleVersion(versionId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('schedule_versions').delete().eq('id', versionId)

  if (error) return { error: 'Could not delete version.' }

  revalidatePath('/admin/suggestions')
  return { error: null }
}
