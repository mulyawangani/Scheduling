/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdminOrOwner } from '@/lib/auth/require-admin-or-owner'
import { revalidatePath } from 'next/cache'

// ── School (enrollment) payments ─────────────────────────────────────────────

export async function markEnrollmentPaid(studentId: string, month: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  const db = supabase as any
  await db.from('enrollment_payments').upsert({
    student_id: studentId, month, status: 'paid', paid_at: new Date().toISOString(),
  }, { onConflict: 'student_id,month' })
  revalidatePath('/admin/billing')
}

export async function markEnrollmentPending(studentId: string, month: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  const db = supabase as any
  await db.from('enrollment_payments')
    .update({ status: 'pending' })
    .eq('student_id', studentId).eq('month', month)
  revalidatePath('/admin/billing')
}

export async function markEnrollmentUnpaid(studentId: string, month: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  const db = supabase as any
  await db.from('enrollment_payments')
    .update({ status: 'unpaid', paid_at: null, xendit_payment_id: null })
    .eq('student_id', studentId).eq('month', month)
  revalidatePath('/admin/billing')
}

// ── Therapy payments ──────────────────────────────────────────────────────────

export async function markTherapyPaid(studentId: string, month: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  const db = supabase as any
  await db.from('therapy_payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('student_id', studentId).eq('month', month)
  revalidatePath('/admin/billing')
}

export async function markTherapyPending(studentId: string, month: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  const db = supabase as any
  await db.from('therapy_payments')
    .update({ status: 'pending' })
    .eq('student_id', studentId).eq('month', month)
  revalidatePath('/admin/billing')
}

export async function markTherapyUnpaid(studentId: string, month: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  const db = supabase as any
  await db.from('therapy_payments')
    .update({ status: 'unpaid', paid_at: null, xendit_payment_id: null })
    .eq('student_id', studentId).eq('month', month)
  revalidatePath('/admin/billing')
}

// Called after reconciliation to persist session_count + rate into therapy_payments
export async function upsertTherapyPayment(
  studentId: string,
  schoolId: string | null,
  month: string,
  sessionCount: number,
  ratePerSession: number,
) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  const db = supabase as any

  // Check if a payment row already exists
  const { data: existing } = await db
    .from('therapy_payments')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('month', month)
    .maybeSingle()

  const totalAmount = sessionCount * ratePerSession

  if (existing) {
    // Only update count/amount if not yet paid
    if (existing.status !== 'paid') {
      await db.from('therapy_payments')
        .update({ session_count: sessionCount, rate_per_session: ratePerSession, total_amount: totalAmount })
        .eq('id', existing.id)
    }
  } else {
    await db.from('therapy_payments').insert({
      student_id: studentId,
      school_id: schoolId,
      month,
      session_count: sessionCount,
      rate_per_session: ratePerSession,
      total_amount: totalAmount,
      status: 'unpaid',
    })
  }

  revalidatePath('/admin/billing')
}
