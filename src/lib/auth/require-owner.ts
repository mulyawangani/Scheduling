import { redirect } from 'next/navigation'
import { getUserProfile } from './get-user-profile'

/**
 * The /admin layout admits both 'owner' and the narrower 'admin' role, since
 * they share three pages under /admin/suggestions: Schedules (push confirmed
 * sessions to parents via WhatsApp — admin's actual job), Billing, and
 * Reports. Everything else — Simulations/Generate Schedule, Manual Addition,
 * the Assign detail page, Capacity, Quota, Rules, Recommendation, and every
 * top-level page outside /admin/suggestions (Children, Teachers, Protocols,
 * Parents, Calendar, Therapy notes, Audit log) — calls this to stay
 * owner-exclusive.
 */
export async function requireOwner() {
  const result = await getUserProfile()
  if (!result || result.profile.role !== 'owner') {
    redirect('/admin/suggestions/schedules')
  }
}
