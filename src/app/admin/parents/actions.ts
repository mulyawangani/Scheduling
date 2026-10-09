'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { authorize } from '@/lib/auth/require-capability'

export async function setPriorityTier(parentId: string, tier: number) {
  const auth = await authorize('people.parent.edit')
  if (!auth.ok) return { error: auth.error }
  if (![0, 1, 2].includes(tier)) return { error: 'Priority must be Standard, Priority or VIP.' }
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .update({ priority_tier: tier })
    .eq('id', parentId)
    .eq('role', 'parent')
    .select('id')

  if (error) return { error: 'Could not update priority tier.' }
  if (!data?.length) return { error: 'Not saved: your account is not allowed to change this parent.' }

  revalidatePath('/admin/parents')
  return { error: null }
}

export async function updateParentProfile(parentId: string, name: string, phone: string) {
  const auth = await authorize('people.parent.edit')
  if (!auth.ok) return { error: auth.error }
  const trimmedName = name.trim()
  if (!trimmedName) return { error: 'Name is required.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ name: trimmedName, phone: phone.trim() || null })
    .eq('id', parentId)
    .eq('role', 'parent')
    .select('id')

  if (error) return { error: 'Could not update parent.' }
  if (!data?.length) return { error: 'Not saved: your account is not allowed to change this parent.' }

  revalidatePath('/admin/parents')
  return { error: null }
}
