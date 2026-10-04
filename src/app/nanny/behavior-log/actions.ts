'use server'

import { createClient } from '@/lib/supabase/server'
import { requireNanny } from '@/lib/auth/require-nanny'
import { revalidatePath } from 'next/cache'

const WIB_OFFSET = 7 * 60 * 60 * 1000

export async function addBehaviorLog(formData: FormData) {
  const { user } = await requireNanny()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any

  const studentId   = formData.get('student_id') as string
  const type        = formData.get('type') as string
  const severity    = formData.get('severity') as string | null
  const description = formData.get('description') as string

  if (!studentId || !type || !description?.trim()) return

  const today = new Date(Date.now() + WIB_OFFSET).toISOString().slice(0, 10)

  // Get student's school_id
  const { data: student } = await db.from('students').select('school_id').eq('id', studentId).single()
  if (!student?.school_id) return

  await db.from('behavior_logs').insert({
    student_id:     studentId,
    school_id:      student.school_id,
    recorded_by_id: user.id,
    date:           today,
    type,
    severity:       severity || null,
    description:    description.trim(),
  })

  revalidatePath('/nanny/behavior-log')
  revalidatePath('/nanny/dashboard')
}
