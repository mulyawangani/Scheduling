'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleProtocol(
  studentId: string,
  protocolId: string,
  subProtocolId: string | null,
  enabled: boolean
) {
  const supabase = await createClient()

  if (enabled) {
    const { error } = await supabase
      .from('student_protocols')
      .insert({ student_id: studentId, protocol_id: protocolId, sub_protocol_id: subProtocolId })
    if (error) return { error: 'Could not add protocol.' }
  } else {
    let query = supabase.from('student_protocols').delete().eq('student_id', studentId).eq('protocol_id', protocolId)
    query = subProtocolId ? query.eq('sub_protocol_id', subProtocolId) : query.is('sub_protocol_id', null)
    const { error } = await query
    if (error) return { error: 'Could not remove protocol.' }
  }

  revalidatePath(`/parent/students/${studentId}`)
  return { error: null }
}

export async function addAvailability(studentId: string, formData: FormData) {
  const supabase = await createClient()

  const day = formData.get('day')
  const specificDate = String(formData.get('specificDate') || '')
  const startTime = String(formData.get('startTime') || '')
  const endTime = String(formData.get('endTime') || '')

  const hasDay = day !== null && day !== ''
  if ((!hasDay && !specificDate) || !startTime || !endTime) {
    return { error: 'A day (or specific date), start time, and end time are all required.' }
  }

  if (startTime >= endTime) {
    return { error: 'End time must be after start time.' }
  }

  const { error } = await supabase.from('student_availability').insert({
    student_id: studentId,
    day_of_week: hasDay ? Number(day) : null,
    specific_date: hasDay ? null : specificDate,
    start_time: startTime,
    end_time: endTime,
  })

  if (error) return { error: 'Could not add availability.' }

  revalidatePath(`/parent/students/${studentId}`)
  return { error: null }
}

export async function removeAvailability(studentId: string, availabilityId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('student_availability').delete().eq('id', availabilityId)

  if (error) return { error: 'Could not remove availability.' }

  revalidatePath(`/parent/students/${studentId}`)
  return { error: null }
}

export async function cancelSession(studentId: string, sessionId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('session_plans')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('id', sessionId)
    .in('status', ['pending', 'accepted'])

  if (error) return { error: 'Could not cancel session.' }

  revalidatePath(`/parent/students/${studentId}`)
  return { error: null }
}
