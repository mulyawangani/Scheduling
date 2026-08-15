'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleSubject(studentId: string, subjectId: string, enabled: boolean) {
  const supabase = await createClient()

  if (enabled) {
    const { error } = await supabase
      .from('student_subjects')
      .insert({ student_id: studentId, subject_id: subjectId })
    if (error) return { error: 'Could not add subject.' }
  } else {
    const { error } = await supabase
      .from('student_subjects')
      .delete()
      .eq('student_id', studentId)
      .eq('subject_id', subjectId)
    if (error) return { error: 'Could not remove subject.' }
  }

  revalidatePath(`/parent/students/${studentId}`)
  return { error: null }
}

export async function addAvailability(studentId: string, formData: FormData) {
  const supabase = await createClient()

  const day = formData.get('day')
  const startTime = String(formData.get('startTime') || '')
  const endTime = String(formData.get('endTime') || '')

  if (day === null || day === '' || !startTime || !endTime) {
    return { error: 'Day, start time, and end time are all required.' }
  }

  if (startTime >= endTime) {
    return { error: 'End time must be after start time.' }
  }

  const { error } = await supabase.from('student_availability').insert({
    student_id: studentId,
    day_of_week: Number(day),
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
