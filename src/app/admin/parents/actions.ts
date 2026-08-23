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

export async function updateParentProfile(parentId: string, name: string, phone: string) {
  const trimmedName = name.trim()
  if (!trimmedName) return { error: 'Name is required.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ name: trimmedName, phone: phone.trim() || null })
    .eq('id', parentId)

  if (error) return { error: 'Could not update parent.' }

  revalidatePath('/admin/parents')
  return { error: null }
}
