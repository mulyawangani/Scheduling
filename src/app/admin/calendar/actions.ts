'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createHoliday(formData: FormData) {
  const date = String(formData.get('date') || '')
  const name = String(formData.get('name') || '').trim()
  const type = String(formData.get('type') || 'school')

  if (!date) return { error: 'Date is required.' }
  if (!name) return { error: 'Holiday name is required.' }
  if (type !== 'school' && type !== 'public') return { error: 'Invalid holiday type.' }

  const supabase = await createClient()
  const { error } = await supabase.from('holidays').upsert({ date, name, type }, { onConflict: 'date' })

  if (error) return { error: 'Could not save holiday.' }

  revalidatePath('/admin/calendar')
  return { error: null }
}

export async function deleteHoliday(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('holidays').delete().eq('id', id)

  if (error) return { error: 'Could not remove holiday.' }

  revalidatePath('/admin/calendar')
  return { error: null }
}
