'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function setPriorityTier(parentId: string, tier: number) {
  const supabase = await createClient()

  const { error } = await supabase.from('profiles').update({ priority_tier: tier }).eq('id', parentId)

  if (error) return { error: 'Could not update priority tier.' }

  revalidatePath('/admin/parents')
  return { error: null }
}
