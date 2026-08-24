'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Sets a child's billing/commission rate — either her default (teacherId
 * null, applies to any teacher without her own row) or a specific teacher's
 * own rate for that child. Upserts by hand rather than relying on a DB
 * on-conflict target, since the uniqueness here is enforced by two partial
 * indexes (one for the null case, one for the not-null case) that Postgres
 * can't address as a single on-conflict column list.
 */
export async function setBillingRate(studentId: string, teacherId: string | null, billingRateInput: string, commissionRateInput: string) {
  const billingRate = Number(billingRateInput)
  const commissionRate = Number(commissionRateInput)

  if (!Number.isFinite(billingRate) || billingRate < 0) return { error: 'Billing rate must be a non-negative number.' }
  if (!Number.isFinite(commissionRate) || commissionRate < 0) return { error: 'Commission rate must be a non-negative number.' }

  const supabase = await createClient()

  let existingQuery = supabase.from('billing_rates').select('id').eq('student_id', studentId)
  existingQuery = teacherId ? existingQuery.eq('teacher_id', teacherId) : existingQuery.is('teacher_id', null)
  const { data: existing } = await existingQuery.maybeSingle()

  const { error } = existing
    ? await supabase.from('billing_rates').update({ billing_rate: billingRate, commission_rate: commissionRate }).eq('id', existing.id)
    : await supabase.from('billing_rates').insert({ student_id: studentId, teacher_id: teacherId, billing_rate: billingRate, commission_rate: commissionRate })

  if (error) return { error: 'Could not save rate.' }

  revalidatePath('/admin/suggestions/billing')
  revalidatePath('/teacher/commissions')
  return { error: null }
}

export async function deleteBillingRate(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('billing_rates').delete().eq('id', id)

  if (error) return { error: 'Could not remove rate.' }

  revalidatePath('/admin/suggestions/billing')
  revalidatePath('/teacher/commissions')
  return { error: null }
}
