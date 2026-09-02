'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { StudentStatus } from '@/lib/supabase/types'
import { logAudit } from '@/lib/audit'

const SCHOOL_HOURS_WEEKDAYS = [1, 2, 3, 4, 5]
const SCHOOL_HOURS_START = '08:00:00'
const SCHOOL_HOURS_END = '12:00:00'

export async function ownerToggleProtocol(
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
    // placeholder for the same protocol (e.g. one left over from the
    // 2026-08-27 data-loss recovery, which could only restore Reflex
    // Repatterning at the protocol level) — clear it so it doesn't linger as
    // an invisible duplicate need alongside the now-specific one.
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

  revalidatePath('/admin/children')
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

export async function updateChildProfile(studentId: string, formData: FormData) {
  const supabase = await createClient()

  const name = String(formData.get('name') || '').trim()
  const dateOfBirth = String(formData.get('dateOfBirth') || '')
  const ratePerSession = String(formData.get('ratePerSession') || '')
  const priority = String(formData.get('priority') || '')
  const status = String(formData.get('status') || '') as StudentStatus | ''
  const weeklyTargetSessions = String(formData.get('weeklyTargetSessions') || '')

  if (!name) return { error: 'Name is required.' }
  if (weeklyTargetSessions !== '1' && weeklyTargetSessions !== '2' && weeklyTargetSessions !== '3') {
    return { error: 'Weekly target sessions must be 1, 2, or 3.' }
  }

  const { error } = await supabase
    .from('students')
    .update({
      name,
      date_of_birth: dateOfBirth || null,
      rate_per_session: ratePerSession ? Number(ratePerSession) : null,
      priority: priority ? Number(priority) : null,
      status: status || null,
      weekly_target_sessions: Number(weeklyTargetSessions),
    })
    .eq('id', studentId)

  if (error) return { error: 'Could not update profile.' }

  if (status === 'student') {
    await supabase.from('student_availability').delete().eq('student_id', studentId)
    const { error: availError } = await supabase.from('student_availability').insert(
      SCHOOL_HOURS_WEEKDAYS.map((day_of_week) => ({
        student_id: studentId,
        day_of_week,
        start_time: SCHOOL_HOURS_START,
        end_time: SCHOOL_HOURS_END,
      }))
    )
    if (availError) return { error: 'Profile saved, but could not set school-hours availability.' }
  }

  revalidatePath('/admin/children')
  return { error: null }
}

export async function createChild(formData: FormData) {
  const supabase = await createClient()

  const parentId = String(formData.get('parentId') || '')
  const name = String(formData.get('name') || '').trim()

  if (!parentId || !name) return { error: 'Parent and name are required.' }

  const { error } = await supabase.from('students').insert({ parent_id: parentId, name })

  if (error) return { error: 'Could not add child.' }

  revalidatePath('/admin/children')
  return { error: null }
}

export async function deleteChild(studentId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('students').delete().eq('id', studentId)

  if (error) return { error: 'Could not delete child.' }

  revalidatePath('/admin/children')
  return { error: null }
}
