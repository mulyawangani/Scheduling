'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createProtocol(formData: FormData) {
  const supabase = await createClient()

  const title = String(formData.get('title') || '').trim()
  const instructions = String(formData.get('instructions') || '').trim()

  if (!title) return { error: 'Title is required.' }

  const { error } = await supabase.from('protocols').insert({ title, instructions: instructions || null })

  if (error) return { error: 'Could not create protocol.' }

  revalidatePath('/admin/protocols')
  return { error: null }
}

export async function toggleProtocolActive(protocolId: string, isActive: boolean) {
  const supabase = await createClient()

  const { error } = await supabase.from('protocols').update({ is_active: isActive }).eq('id', protocolId)

  if (error) return { error: 'Could not update protocol.' }

  revalidatePath('/admin/protocols')
  return { error: null }
}

export async function deleteProtocol(protocolId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('protocols').delete().eq('id', protocolId)

  if (error) return { error: 'Could not delete protocol (it may still have assignments or student needs).' }

  revalidatePath('/admin/protocols')
  return { error: null }
}

export async function createSubProtocol(protocolId: string, formData: FormData) {
  const supabase = await createClient()

  const title = String(formData.get('title') || '').trim()
  if (!title) return { error: 'Title is required.' }

  const { error } = await supabase.from('sub_protocols').insert({ protocol_id: protocolId, title })

  if (error) return { error: 'Could not create sub-protocol.' }

  revalidatePath('/admin/protocols')
  return { error: null }
}

export async function toggleSubProtocolActive(subProtocolId: string, isActive: boolean) {
  const supabase = await createClient()

  const { error } = await supabase.from('sub_protocols').update({ is_active: isActive }).eq('id', subProtocolId)

  if (error) return { error: 'Could not update sub-protocol.' }

  revalidatePath('/admin/protocols')
  return { error: null }
}

export async function deleteSubProtocol(subProtocolId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('sub_protocols').delete().eq('id', subProtocolId)

  if (error) return { error: 'Could not delete sub-protocol (it may still have assignments).' }

  revalidatePath('/admin/protocols')
  return { error: null }
}
