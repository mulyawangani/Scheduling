'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { redirect } from 'next/navigation'

export async function updateProfile(formData: FormData) {
  const result = await getUserProfile()
  if (!result) redirect('/login')

  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const phone = (formData.get('phone') as string | null)?.trim() || null

  if (!name) return { error: 'Name is required' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ name, phone })
    .eq('id', result.user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function setTeacherProtocol(protocolId: string, rating: number) {
  const result = await getUserProfile()
  if (!result) redirect('/login')

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('teacher_protocols')
    .select('id')
    .eq('teacher_id', result.user.id)
    .eq('protocol_id', protocolId)
    .is('sub_protocol_id', null)
    .single()

  if (existing) {
    await supabase
      .from('teacher_protocols')
      .update({ rating })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('teacher_protocols')
      .insert({ teacher_id: result.user.id, protocol_id: protocolId, rating })
  }

  return { success: true }
}

export async function removeTeacherProtocol(protocolId: string) {
  const result = await getUserProfile()
  if (!result) redirect('/login')

  const supabase = await createClient()
  await supabase
    .from('teacher_protocols')
    .delete()
    .eq('teacher_id', result.user.id)
    .eq('protocol_id', protocolId)
    .is('sub_protocol_id', null)

  return { success: true }
}
