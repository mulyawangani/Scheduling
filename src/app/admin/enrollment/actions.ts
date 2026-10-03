/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdminOrOwner } from '@/lib/auth/require-admin-or-owner'
import { revalidatePath } from 'next/cache'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { redirect } from 'next/navigation'

export async function markAttendance(studentId: string, date: string, status: 'present' | 'absent' | 'late' | 'excused') {
  const profileResult = await getUserProfile()
  if (!profileResult) redirect('/login')
  const { profile } = profileResult
  if (!['owner', 'admin', 'nanny'].includes(profile.role)) redirect('/')

  const supabase = await createClient()
  const db = supabase as any

  await db.from('attendance_records').upsert({
    student_id: studentId,
    date,
    status,
    recorded_by: profile.id,
  }, { onConflict: 'student_id,date' })

  revalidatePath('/admin/enrollment')
}

export async function addEnrollment(studentId: string, month: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: student } = await supabase.from('students').select('school_id').eq('id', studentId).single()

  await db.from('enrollments').upsert({
    student_id: studentId,
    school_id: student?.school_id,
    month,
    status: 'active',
  }, { onConflict: 'student_id,month' })

  revalidatePath('/admin/enrollment')
}

export async function cancelEnrollment(studentId: string, month: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  const db = supabase as any

  await db.from('enrollments').update({ status: 'cancelled' })
    .eq('student_id', studentId).eq('month', month)

  revalidatePath('/admin/enrollment')
}
