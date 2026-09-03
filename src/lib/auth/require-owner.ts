import { redirect } from 'next/navigation'
import { getUserProfile } from './get-user-profile'

/**
 * The /admin layout admits both 'owner' and the narrower 'admin' role, since
 * they share most of /admin/suggestions (Simulations, Schedules, Billing,
 * Reports). Pages outside that scope (Children, Teachers, Protocols,
 * Parents, Calendar, Therapy notes, Audit log, and the suggestions
 * sub-pages 'admin' shouldn't touch — Capacity, Quota, Rules,
 * Recommendation) call this to stay owner-exclusive.
 */
export async function requireOwner() {
  const result = await getUserProfile()
  if (!result || result.profile.role !== 'owner') {
    redirect('/admin/suggestions')
  }
}
