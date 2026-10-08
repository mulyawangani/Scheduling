import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { createClient } from '@/lib/supabase/server'
import type { RegistrationPrefill } from '@/app/signup/register/registration-form'
import { AddChildFlow } from './add-child-flow'

export const dynamic = 'force-dynamic'

type ContactRow = {
  student_id: string
  type: 'father' | 'mother' | 'emergency'
  full_name: string
  phone_mobile: string | null
  phone_home: string | null
  email: string | null
  date_of_birth: string | null
  employment: string | null
  relationship: string | null
}

function parentPrefill(c: ContactRow) {
  return {
    fullName: c.full_name,
    phoneMobile: c.phone_mobile ?? '',
    phoneHome: c.phone_home ?? '',
    email: c.email ?? '',
    dateOfBirth: c.date_of_birth ?? '',
    employment: c.employment ?? '',
  }
}

export default async function AddChildPage() {
  const result = await getUserProfile()
  if (!result) redirect('/login')

  const supabase = await createClient()

  // Newest child first. Family details are copied from the newest child that has contacts on file.
  const { data: kids } = await supabase
    .from('students')
    .select('id, name, nationality, religion, address, phone_home, school_id')
    .eq('parent_id', result.user.id)
    .order('created_at', { ascending: false })

  const list = kids ?? []
  let prefill: RegistrationPrefill | undefined

  if (list.length > 0) {
    const { data: contactRows } = await supabase
      .from('student_contacts')
      .select('student_id, type, full_name, phone_mobile, phone_home, email, date_of_birth, employment, relationship')
      .in('student_id', list.map(k => k.id))
    const contacts = (contactRows ?? []) as ContactRow[]

    const source = list.find(k => contacts.some(c => c.student_id === k.id)) ?? list[0]
    const mine = contacts.filter(c => c.student_id === source.id)
    const father = mine.find(c => c.type === 'father')
    const mother = mine.find(c => c.type === 'mother')
    const emergency = mine.find(c => c.type === 'emergency')

    prefill = {
      fromChildName: source.name,
      child: {
        nationality: source.nationality ?? '',
        religion: source.religion ?? '',
        address: source.address ?? '',
        phoneHome: source.phone_home ?? '',
        schoolId: source.school_id ?? '',
      },
      ...(father ? { father: parentPrefill(father) } : {}),
      ...(mother ? { mother: parentPrefill(mother) } : {}),
      ...(emergency
        ? { emergency: { fullName: emergency.full_name, phoneMobile: emergency.phone_mobile ?? '', relationship: emergency.relationship ?? '' } }
        : {}),
    }
  }

  return (
    <AddChildFlow
      prefill={prefill}
      existingNames={list.map(k => k.name.trim().toLowerCase())}
    />
  )
}
