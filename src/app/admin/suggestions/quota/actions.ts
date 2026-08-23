'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateTeacherQuota(teacherId: string, weeklyQuotaInput: string, dailyQuotaInput: string) {
  const weeklyQuota = weeklyQuotaInput.trim() === '' ? null : Number(weeklyQuotaInput)
  const dailyQuota = dailyQuotaInput.trim() === '' ? null : Number(dailyQuotaInput)

  if (
    (weeklyQuota !== null && (!Number.isFinite(weeklyQuota) || weeklyQuota < 0)) ||
    (dailyQuota !== null && (!Number.isFinite(dailyQuota) || dailyQuota < 0))
  ) {
    return { error: 'Quota must be a non-negative number.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ weekly_quota: weeklyQuota, daily_quota: dailyQuota })
    .eq('id', teacherId)

  if (error) return { error: 'Could not update quota.' }

  revalidatePath('/admin/suggestions/quota')
  return { error: null }
}
