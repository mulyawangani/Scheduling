/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/require-capability'
import { revalidatePath } from 'next/cache'

// ── School (enrollment) payments ─────────────────────────────────────────────

export async function markEnrollmentPaid(studentId: string, month: string) {
  await requireCapability('ops.billing', 'change')
  const supabase = await createClient()
  const db = supabase as any
  await db.from('enrollment_payments').upsert({
    student_id: studentId, month, status: 'paid', paid_at: new Date().toISOString(),
  }, { onConflict: 'student_id,month' })
  revalidatePath('/admin/billing')
}

export async function markEnrollmentPending(studentId: string, month: string) {
  await requireCapability('ops.billing', 'change')
  const supabase = await createClient()
  const db = supabase as any
  await db.from('enrollment_payments')
    .update({ status: 'pending' })
    .eq('student_id', studentId).eq('month', month)
  revalidatePath('/admin/billing')
}

export async function markEnrollmentUnpaid(studentId: string, month: string) {
  await requireCapability('ops.billing', 'change')
  const supabase = await createClient()
  const db = supabase as any
  await db.from('enrollment_payments')
    .update({ status: 'unpaid', paid_at: null, xendit_payment_id: null })
    .eq('student_id', studentId).eq('month', month)
  revalidatePath('/admin/billing')
}

// ── Therapy payments ──────────────────────────────────────────────────────────

export async function markTherapyPaid(studentId: string, month: string) {
  await requireCapability('ops.billing', 'change')
  const supabase = await createClient()
  const db = supabase as any
  await db.from('therapy_payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('student_id', studentId).eq('month', month)
  revalidatePath('/admin/billing')
}

export async function markTherapyPending(studentId: string, month: string) {
  await requireCapability('ops.billing', 'change')
  const supabase = await createClient()
  const db = supabase as any
  await db.from('therapy_payments')
    .update({ status: 'pending' })
    .eq('student_id', studentId).eq('month', month)
  revalidatePath('/admin/billing')
}

export async function markTherapyUnpaid(studentId: string, month: string) {
  await requireCapability('ops.billing', 'change')
  const supabase = await createClient()
  const db = supabase as any
  await db.from('therapy_payments')
    .update({ status: 'unpaid', paid_at: null, xendit_payment_id: null })
    .eq('student_id', studentId).eq('month', month)
  revalidatePath('/admin/billing')
}
