'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'

/**
 * Cancels the given one-off session_plans rows — same soft status change
 * every other removal in this app uses (Cancel, Decline, Reset all), rather
 * than a hard delete. Used by the Reports page's "Cancel all" to reset a
 * month's "done" transactions back to unscheduled without destroying the
 * session history or its therapy notes.
 */
export async function cancelMonthlyTransactions(sessionIds: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }
  if (sessionIds.length === 0) return { error: null }

  const { data, error } = await supabase
    .from('session_plans')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .in('id', sessionIds)
    .eq('status', 'completed')
    .select('id')

  if (error) return { error: 'Could not cancel sessions.' }

  logAudit(supabase, user.id, 'cancel_monthly_transactions', 'session_plans', undefined, { count: data?.length ?? 0, sessionIds })

  revalidatePath('/admin/suggestions/reports')
  return { error: null }
}
