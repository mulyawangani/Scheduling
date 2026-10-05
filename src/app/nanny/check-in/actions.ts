'use server'

import { createClient } from '@/lib/supabase/server'
import { requireNanny } from '@/lib/auth/require-nanny'
import { revalidatePath } from 'next/cache'

const WIB_OFFSET = 7 * 60 * 60 * 1000

function todayWIB(): string {
  return new Date(Date.now() + WIB_OFFSET).toISOString().slice(0, 10)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function db() { return (await createClient()) as any }

export async function checkInStudent(
  studentId: string,
  temperature?: number | null,
  physicalNote?: string | null,
): Promise<{ error?: string }> {
  const { user } = await requireNanny()
  const supabase = await db()
  const today = todayWIB()
  const now = new Date().toISOString()

  const { error } = await supabase.from('attendance_records').upsert(
    {
      student_id: studentId,
      date: today,
      status: 'present',
      check_in_at: now,
      recorded_by: user.id,
      ...(temperature != null ? { temperature } : {}),
      ...(physicalNote ? { physical_note: physicalNote } : {}),
    },
    { onConflict: 'student_id,date', ignoreDuplicates: false }
  )

  if (error) return { error: error.message }

  revalidatePath('/nanny/check-in')
  revalidatePath('/nanny/dashboard')
  return {}
}

export async function checkOutStudent(studentId: string): Promise<{ error?: string }> {
  await requireNanny()
  const supabase = await db()
  const today = todayWIB()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('attendance_records')
    .update({ check_out_at: now })
    .eq('student_id', studentId)
    .eq('date', today)

  if (error) return { error: error.message }

  revalidatePath('/nanny/check-in')
  revalidatePath('/nanny/dashboard')
  return {}
}

export async function markAbsent(studentId: string): Promise<{ error?: string }> {
  const { user } = await requireNanny()
  const supabase = await db()
  const today = todayWIB()

  const { error } = await supabase.from('attendance_records').upsert(
    {
      student_id: studentId,
      date: today,
      status: 'absent',
      recorded_by: user.id,
    },
    { onConflict: 'student_id,date', ignoreDuplicates: false }
  )

  if (error) return { error: error.message }

  revalidatePath('/nanny/check-in')
  revalidatePath('/nanny/dashboard')
  return {}
}
