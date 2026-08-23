'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { StudentStatus } from '@/lib/supabase/types'

const SCHOOL_HOURS_WEEKDAYS = [1, 2, 3, 4, 5]
const SCHOOL_HOURS_START = '08:00:00'
const SCHOOL_HOURS_END = '12:00:00'

export async function createStudent(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be signed in.' }
  }

  const name = String(formData.get('name') || '').trim()
  const protocolIds = formData.getAll('protocolIds').map(String)
  const status = String(formData.get('status') || '') as StudentStatus | ''
  const day = formData.get('day')
  const specificDate = String(formData.get('specificDate') || '')
  const startTime = String(formData.get('startTime') || '')
  const endTime = String(formData.get('endTime') || '')

  if (!name) {
    return { error: 'Student name is required.' }
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({ parent_id: user.id, name, status: status || null })
    .select('id')
    .single()

  if (studentError || !student) {
    return { error: 'Could not create student.' }
  }

  if (protocolIds.length > 0) {
    const needs = protocolIds.map((value) => {
      const [protocolId, subProtocolId] = value.split(':')
      return { student_id: student.id, protocol_id: protocolId, sub_protocol_id: subProtocolId ?? null }
    })
    const { error: protocolsError } = await supabase.from('student_protocols').insert(needs)

    if (protocolsError) {
      return { error: 'Student created, but could not save protocols.' }
    }
  }

  if (status === 'student') {
    const { error: availabilityError } = await supabase.from('student_availability').insert(
      SCHOOL_HOURS_WEEKDAYS.map((day_of_week) => ({
        student_id: student.id,
        day_of_week,
        start_time: SCHOOL_HOURS_START,
        end_time: SCHOOL_HOURS_END,
      }))
    )
    if (availabilityError) {
      return { error: 'Student created, but could not set school-hours availability.' }
    }
  } else if (((day !== null && day !== '') || specificDate) && startTime && endTime) {
    const hasDay = day !== null && day !== ''
    const { error: availabilityError } = await supabase.from('student_availability').insert({
      student_id: student.id,
      day_of_week: hasDay ? Number(day) : null,
      specific_date: hasDay ? null : specificDate,
      start_time: startTime,
      end_time: endTime,
    })

    if (availabilityError) {
      return { error: 'Student created, but could not save availability.' }
    }
  }

  redirect(`/parent/students/${student.id}`)
}
