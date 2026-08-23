'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Flags a need to jump the queue on the next Generate Schedule run — cleared automatically once it's booked, or by hand via unprioritizeNeed. */
export async function prioritizeNeed(studentId: string, protocolId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('prioritized_needs')
    .upsert({ student_id: studentId, protocol_id: protocolId }, { onConflict: 'student_id,protocol_id' })

  if (error) return { error: 'Could not prioritize this need.' }

  revalidatePath('/admin/suggestions/recommendation')
  revalidatePath('/admin/suggestions/reports')
  revalidatePath('/admin/suggestions/rules')
  return { error: null }
}

export async function unprioritizeNeed(studentId: string, protocolId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('prioritized_needs')
    .delete()
    .eq('student_id', studentId)
    .eq('protocol_id', protocolId)

  if (error) return { error: 'Could not un-prioritize this need.' }

  revalidatePath('/admin/suggestions/recommendation')
  revalidatePath('/admin/suggestions/reports')
  revalidatePath('/admin/suggestions/rules')
  return { error: null }
}
