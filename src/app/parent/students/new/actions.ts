'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createStudent(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be signed in.' }
  }

  const name = String(formData.get('name') || '').trim()
  const subjectIds = formData.getAll('subjectIds').map(String)
  const day = formData.get('day')
  const startTime = String(formData.get('startTime') || '')
  const endTime = String(formData.get('endTime') || '')

  if (!name) {
    return { error: 'Student name is required.' }
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({ parent_id: user.id, name })
    .select('id')
    .single()

  if (studentError || !student) {
    return { error: 'Could not create student.' }
  }

  if (subjectIds.length > 0) {
    const { error: subjectsError } = await supabase
      .from('student_subjects')
      .insert(subjectIds.map((subject_id) => ({ student_id: student.id, subject_id })))

    if (subjectsError) {
      return { error: 'Student created, but could not save subjects.' }
    }
  }

  if (day !== null && day !== '' && startTime && endTime) {
    const { error: availabilityError } = await supabase.from('student_availability').insert({
      student_id: student.id,
      day_of_week: Number(day),
      start_time: startTime,
      end_time: endTime,
    })

    if (availabilityError) {
      return { error: 'Student created, but could not save availability.' }
    }
  }

  redirect(`/parent/students/${student.id}`)
}
