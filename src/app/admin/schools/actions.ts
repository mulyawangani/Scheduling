'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireCapability } from '@/lib/auth/require-capability'

export async function createSchool(formData: FormData) {
  await requireCapability('settings.school', 'change')
  const supabase = await createClient()
  const name = String(formData.get('name') || '').trim()
  if (!name) return { error: 'School name is required.' }
  const { error } = await supabase.from('schools').insert({ name })
  if (error) return { error: error.message }
  revalidatePath('/admin/schools')
  return { error: null }
}

export async function deleteSchool(id: string) {
  await requireCapability('settings.school', 'change')
  const supabase = await createClient()
  const { error } = await supabase.from('schools').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/schools')
  return { error: null }
}
