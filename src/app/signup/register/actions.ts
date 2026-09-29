'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export interface RegistrationData {
  child: {
    fullName: string
    nickname: string
    dateOfBirth: string
    gender: string
    nationality: string
    religion: string
    address: string
    phoneHome: string
    previousSchool: string
  }
  father: {
    fullName: string
    phoneMobile: string
    phoneHome: string
    email: string
    dateOfBirth: string
    employment: string
  }
  mother: {
    fullName: string
    phoneMobile: string
    phoneHome: string
    email: string
    dateOfBirth: string
    employment: string
  }
  emergency: {
    fullName: string
    phoneMobile: string
    relationship: string
  }
}

export async function submitRegistration(data: RegistrationData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expired. Please sign in again.' }

  const admin = createAdminClient()

  const { data: student, error: studentError } = await admin
    .from('students')
    .insert({
      parent_id: user.id,
      name: data.child.fullName,
      nickname: data.child.nickname || null,
      date_of_birth: data.child.dateOfBirth || null,
      gender: data.child.gender || null,
      nationality: data.child.nationality || null,
      religion: data.child.religion || null,
      address: data.child.address || null,
      phone_home: data.child.phoneHome || null,
      previous_school: data.child.previousSchool || null,
      status: null,
    })
    .select('id')
    .single()

  if (studentError || !student) {
    return { error: studentError?.message ?? 'Failed to save child information.' }
  }

  const contacts = [
    {
      student_id: student.id,
      type: 'father' as const,
      full_name: data.father.fullName,
      phone_mobile: data.father.phoneMobile || null,
      phone_home: data.father.phoneHome || null,
      email: data.father.email || null,
      date_of_birth: data.father.dateOfBirth || null,
      employment: data.father.employment || null,
    },
    {
      student_id: student.id,
      type: 'mother' as const,
      full_name: data.mother.fullName,
      phone_mobile: data.mother.phoneMobile || null,
      phone_home: data.mother.phoneHome || null,
      email: data.mother.email || null,
      date_of_birth: data.mother.dateOfBirth || null,
      employment: data.mother.employment || null,
    },
    {
      student_id: student.id,
      type: 'emergency' as const,
      full_name: data.emergency.fullName,
      phone_mobile: data.emergency.phoneMobile || null,
      relationship: data.emergency.relationship || null,
    },
  ]

  const { error: contactsError } = await admin
    .from('student_contacts')
    .insert(contacts)

  if (contactsError) {
    await admin.from('students').delete().eq('id', student.id)
    return { error: contactsError.message }
  }

  return { success: true }
}
