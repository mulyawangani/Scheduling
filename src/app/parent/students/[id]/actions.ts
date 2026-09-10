'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { StudentStatus } from '@/lib/supabase/types'
import { logAudit } from '@/lib/audit'

const SCHOOL_HOURS_WEEKDAYS = [1, 2, 3, 4, 5]
const SCHOOL_HOURS_START = '08:00:00'
const SCHOOL_HOURS_END = '12:00:00'

export async function updateStudentProfile(studentId: string, name: string, status: StudentStatus | '') {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required.' }

  const { error } = await supabase
    .from('students')
    .update({ name: trimmed, status: status || null })
    .eq('id', studentId)

  if (error) return { error: 'Could not update profile.' }

  // Same rule as creating a student: 'student' status means school hours,
  // set automatically rather than the parent building a timetable by hand.
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

  if (user) logAudit(supabase, user.id, 'update_student_profile', 'students', studentId, { name: trimmed, status: status || null })

  revalidatePath(`/parent/students/${studentId}`)
  return { error: null }
}

export async function deleteStudent(studentId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: student } = await supabase.from('students').select('name').eq('id', studentId).single()
  const { error } = await supabase.from('students').delete().eq('id', studentId)

  if (error) return { error: 'Could not delete child.' }

  if (user) logAudit(supabase, user.id, 'delete_student', 'students', studentId, { name: student?.name ?? null })

  revalidatePath('/parent')
  redirect('/parent')
}

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
