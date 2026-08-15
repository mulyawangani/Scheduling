'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addTeacherAvailability(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const day = formData.get('day')
  const startTime = String(formData.get('startTime') || '')
  const endTime = String(formData.get('endTime') || '')

  if (day === null || day === '' || !startTime || !endTime) {
    return { error: 'Day, start time, and end time are all required.' }
  }

  if (startTime >= endTime) {
    return { error: 'End time must be after start time.' }
  }

  const { error } = await supabase.from('teacher_availability').insert({
    teacher_id: user.id,
    day_of_week: Number(day),
    start_time: startTime,
    end_time: endTime,
  })

  if (error) return { error: 'Could not add availability.' }

  revalidatePath('/teacher/availability')
  return { error: null }
}

export async function removeTeacherAvailability(availabilityId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('teacher_availability').delete().eq('id', availabilityId)

  if (error) return { error: 'Could not remove availability.' }

  revalidatePath('/teacher/availability')
  return { error: null }
}
