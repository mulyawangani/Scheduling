'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/lib/auth/require-owner'

export async function createSchool(formData: FormData) {
  await requireOwner()
  const supabase = await createClient()
  const name = String(formData.get('name') || '').trim()
  if (!name) return { error: 'School name is required.' }
  const { error } = await supabase.from('schools').insert({ name })
  if (error) return { error: error.message }
  revalidatePath('/admin/schools')
  return { error: null }
}

export async function deleteSchool(id: string) {
  await requireOwner()
  const supabase = await createClient()
  const { error } = await supabase.from('schools').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/schools')
  return { error: null }
}
