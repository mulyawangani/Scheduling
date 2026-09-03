import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from './get-user-profile'

/**
 * The Assign page is owner-only in general — it's how "Generate Schedule"
 * books sessions, which the narrower 'admin' role explicitly doesn't have.
 * But admin gets one deliberate exception: rescheduling a need that's
 * currently reopened by a cancellation or a teacher decline, since that's
 * the exact job /admin/suggestions/reschedule exists for. Checked here
 * server-side, not just by hiding the "Assign" link on that page — this
 * page is reachable directly by URL for any (studentId, protocolId) pair,
 * so the real boundary has to live here.
 */
export async function requireOwnerOrReschedulableNeed(studentId: string, protocolId: string) {
  const result = await getUserProfile()
  if (!result) redirect('/login')
  if (result.profile.role === 'owner') return
  if (result.profile.role !== 'admin') redirect('/admin/suggestions/schedules')

  const supabase = await createClient()
  const { data: lastSession } = await supabase
    .from('session_plans')
    .select('status')
    .eq('student_id', studentId)
    .eq('protocol_id', protocolId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastSession || (lastSession.status !== 'cancelled' && lastSession.status !== 'declined')) {
    redirect('/admin/suggestions/reschedule')
  }
}
