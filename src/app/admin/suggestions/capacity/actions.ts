'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCapacityRule(formData: FormData) {
  const startTime = String(formData.get('startTime') || '')
  const endTime = String(formData.get('endTime') || '')
  const maxConcurrent = Number(formData.get('maxConcurrent') || 0)

  if (!startTime || !endTime) return { error: 'Start and end time are required.' }
  if (startTime >= endTime) return { error: 'End time must be after start time.' }
  if (!Number.isFinite(maxConcurrent) || maxConcurrent < 1) return { error: 'Max concurrent must be at least 1.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('capacity_rules')
    .insert({ start_time: startTime, end_time: endTime, max_concurrent: maxConcurrent })

  if (error) return { error: 'Could not create capacity rule.' }

  revalidatePath('/admin/suggestions/capacity')
  return { error: null }
}

export async function deleteCapacityRule(ruleId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('capacity_rules').delete().eq('id', ruleId)

  if (error) return { error: 'Could not remove capacity rule.' }

  revalidatePath('/admin/suggestions/capacity')
  return { error: null }
}
