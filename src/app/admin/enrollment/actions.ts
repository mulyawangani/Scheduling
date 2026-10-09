/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/require-capability'
import { revalidatePath } from 'next/cache'

export async function markAttendance(studentId: string, date: string, status: 'present' | 'absent' | 'late' | 'excused') {
  const { profile } = await requireCapability('ops.attendance.record', 'change')

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

const FIRST_OF_MONTH = /^\d{4}-\d{2}-01$/

export async function addEnrollment(studentId: string, month: string): Promise<{ error?: string }> {
  await requireCapability('students.enrollment', 'change')
  if (!FIRST_OF_MONTH.test(month)) return { error: 'Invalid month.' }
  const supabase = await createClient()
  const db = supabase as any

  const { data: student, error: studentError } = await db
    .from('students')
    .select('school_id, status')
    .eq('id', studentId)
    .single()
  if (studentError || !student) return { error: 'Could not find that child.' }
  if (student.status !== 'student') return { error: 'Only children with status Student can be enrolled.' }

  const { data, error } = await db
    .from('enrollments')
    .upsert(
      { student_id: studentId, school_id: student.school_id, month, status: 'active' },
      { onConflict: 'student_id,month' },
    )
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Not saved: your account is not allowed to enroll children.' }

  revalidatePath('/admin/enrollment')
  revalidatePath('/admin/attendance')
  return {}
}

export async function cancelEnrollment(studentId: string, month: string): Promise<{ error?: string }> {
  await requireCapability('students.enrollment', 'change')
  if (!FIRST_OF_MONTH.test(month)) return { error: 'Invalid month.' }
  const supabase = await createClient()
  const db = supabase as any

  const { data, error } = await db
    .from('enrollments')
    .update({ status: 'cancelled' })
    .eq('student_id', studentId)
    .eq('month', month)
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Nothing changed: no enrollment found for that month.' }

  revalidatePath('/admin/enrollment')
  revalidatePath('/admin/attendance')
  return {}
}
