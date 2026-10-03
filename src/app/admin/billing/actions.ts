/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdminOrOwner } from '@/lib/auth/require-admin-or-owner'
import { revalidatePath } from 'next/cache'

export async function markAsPaid(studentId: string, month: string, notes?: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  const db = supabase as any

  await db.from('enrollment_payments').upsert({
    student_id: studentId,
    month,
    status: 'paid',
    paid_at: new Date().toISOString(),
    notes: notes ?? null,
  }, { onConflict: 'student_id,month' })

  revalidatePath('/admin/billing')
}

export async function markAsUnpaid(studentId: string, month: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  const db = supabase as any

  await db.from('enrollment_payments')
    .update({ status: 'unpaid', paid_at: null, xendit_payment_id: null, xendit_invoice_id: null })
    .eq('student_id', studentId)
    .eq('month', month)

  revalidatePath('/admin/billing')
}

export async function markAsPending(studentId: string, month: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  const db = supabase as any

  await db.from('enrollment_payments')
    .update({ status: 'pending' })
    .eq('student_id', studentId)
    .eq('month', month)

  revalidatePath('/admin/billing')
}
