'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'

export async function toggleProtocol(
  studentId: string,
  protocolId: string,
  subProtocolId: string | null,
  enabled: boolean
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (enabled) {
    const { error } = await supabase
      .from('student_protocols')
      .insert({ student_id: studentId, protocol_id: protocolId, sub_protocol_id: subProtocolId })
    if (error) return { error: 'Could not add protocol.' }

    if (user) logAudit(supabase, user.id, 'add_protocol_need', 'student_protocols', undefined, await needLabel(supabase, studentId, protocolId, subProtocolId))

    // Checking a specific sub-protocol supersedes an earlier protocol-level
    // placeholder for the same protocol — clear it so it doesn't linger as an
    // invisible duplicate need alongside the now-specific one.
    if (subProtocolId) {
      await supabase.from('student_protocols').delete().eq('student_id', studentId).eq('protocol_id', protocolId).is('sub_protocol_id', null)
    }
  } else {
    const label = await needLabel(supabase, studentId, protocolId, subProtocolId)
    let query = supabase.from('student_protocols').delete().eq('student_id', studentId).eq('protocol_id', protocolId)
    query = subProtocolId ? query.eq('sub_protocol_id', subProtocolId) : query.is('sub_protocol_id', null)
    const { error } = await query
    if (error) return { error: 'Could not remove protocol.' }

    if (user) logAudit(supabase, user.id, 'remove_protocol_need', 'student_protocols', undefined, label)
  }

  revalidatePath(`/parent/students/${studentId}`)
  return { error: null }
}

async function needLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  protocolId: string,
  subProtocolId: string | null
) {
  const [{ data: student }, { data: protocol }, { data: subProtocol }] = await Promise.all([
    supabase.from('students').select('name').eq('id', studentId).single(),
    supabase.from('protocols').select('title').eq('id', protocolId).single(),
    subProtocolId ? supabase.from('sub_protocols').select('title').eq('id', subProtocolId).single() : Promise.resolve({ data: null }),
  ])
  return {
    label: `${student?.name ?? studentId} — ${protocol?.title ?? protocolId}${subProtocol?.title ? ` (${subProtocol.title})` : ''}`,
  }
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
