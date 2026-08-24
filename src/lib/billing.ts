import type { BillingRate } from '@/lib/supabase/types'

export interface RateLookupResult {
  billingRate: number
  commissionRate: number
  /** True when this came from the student's default (teacher_id null) rate, not a rate specific to this teacher. */
  isDefault: boolean
}

/**
 * A teacher's own rate for this student wins if set; otherwise falls back to
 * the student's default rate (teacher_id null) — the same shape as the
 * owner's original per-child rate sheet, where most teachers shared one
 * rate per child and only a couple had their own. Null when neither exists,
 * meaning billing/commission for this pairing genuinely hasn't been set.
 */
export function lookupBillingRate(rates: BillingRate[], studentId: string, teacherId: string): RateLookupResult | null {
  const exact = rates.find((r) => r.student_id === studentId && r.teacher_id === teacherId)
  if (exact) return { billingRate: exact.billing_rate, commissionRate: exact.commission_rate, isDefault: false }

  const fallback = rates.find((r) => r.student_id === studentId && r.teacher_id === null)
  if (fallback) return { billingRate: fallback.billing_rate, commissionRate: fallback.commission_rate, isDefault: true }

  return null
}

export function groupRatesByStudent(rates: BillingRate[]): Map<string, BillingRate[]> {
  const map = new Map<string, BillingRate[]>()
  for (const r of rates) {
    const arr = map.get(r.student_id) ?? []
    arr.push(r)
    map.set(r.student_id, arr)
  }
  return map
}
