'use server'

import { createClient } from '@/lib/supabase/server'
import { requireNanny } from '@/lib/auth/require-nanny'
import { revalidatePath } from 'next/cache'

const WIB_OFFSET = 7 * 60 * 60 * 1000

export async function addBehaviorLog(data: {
  studentId: string
  type: string
  activity: string
  subActivity?: string
  otherStudentId?: string
  otherTeacherId?: string
  note?: string
}) {
  const { user } = await requireNanny()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any

  if (!data.studentId || !data.type || !data.activity) return

  const today = new Date(Date.now() + WIB_OFFSET).toISOString().slice(0, 10)

  const { data: student } = await db
    .from('students')
    .select('school_id')
    .eq('id', data.studentId)
    .single()
  if (!student?.school_id) return

  await db.from('behavior_logs').insert({
    student_id:       data.studentId,
    school_id:        student.school_id,
    recorded_by_id:   user.id,
    date:             today,
    type:             data.type,
    activity:         data.activity,
    sub_activity:     data.subActivity ?? null,
    description:      data.note?.trim() ?? '',
    other_student_id: data.otherStudentId ?? null,
    other_teacher_id: data.otherTeacherId ?? null,
  })

  revalidatePath('/nanny/behavior-log')
  revalidatePath('/nanny/dashboard')
}
