import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from './get-user-profile'
import { canChange, isStaffRole } from './permissions'
import { schedulingHome } from './admin-nav-config'

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * True when the need's most recent session was cancelled or declined, i.e. the
 * need has been reopened and is waiting to be booked again. This is the one
 * situation in which a role that only has 'sched.reschedule' may book a session.
 */
export async function isReschedulableNeed(supabase: Supabase, studentId: string, protocolId: string): Promise<boolean> {
  const { data: lastSession } = await supabase
    .from('session_plans')
    .select('status')
    .eq('student_id', studentId)
    .eq('protocol_id', protocolId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return !!lastSession && (lastSession.status === 'cancelled' || lastSession.status === 'declined')
}

/**
 * The Assign page is how "Generate Schedule" books sessions, so it needs
 * 'sched.manual'. A role that only has 'sched.reschedule' (Admin today) gets
 * one deliberate exception: rescheduling a need that's currently reopened by
 * a cancellation or a teacher decline, since that's the exact job
 * /admin/suggestions/reschedule exists for. Checked here server-side, not just
 * by hiding the "Assign" link on that page: this page is reachable directly by
 * URL for any (studentId, protocolId) pair, so the real boundary has to live here.
 * The booking action (createSessionPlan) applies the same rule again.
 */
export async function requireManualOrReschedulableNeed(studentId: string, protocolId: string) {
  const result = await getUserProfile()
  if (!result) redirect('/login')
  const role = result.profile.role
  if (!isStaffRole(role)) redirect('/')
  if (canChange(role, 'sched.manual')) return
  if (!canChange(role, 'sched.reschedule')) redirect(schedulingHome(role))

  const supabase = await createClient()
  if (!(await isReschedulableNeed(supabase, studentId, protocolId))) {
    redirect('/admin/suggestions/reschedule')
  }
}
