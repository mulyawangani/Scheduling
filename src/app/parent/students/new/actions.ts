'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { StudentStatus } from '@/lib/supabase/types'

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
  // Status is always 'trial' on creation — only admin/owner can promote
  const status: StudentStatus = 'trial'
  const day = formData.get('day')
  const specificDate = String(formData.get('specificDate') || '')
  const startTime = String(formData.get('startTime') || '')
  const endTime = String(formData.get('endTime') || '')

  if (!name) {
    return { error: 'Student name is required.' }
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({ parent_id: user.id, name, status })
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

  if (((day !== null && day !== '') || specificDate) && startTime && endTime) {
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
