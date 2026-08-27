'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { dateForDayOfWeek } from '@/lib/week'
import { dateStringInBusinessTz } from '@/lib/timezone'
import { logAudit } from '@/lib/audit'

/**
 * Teacher confirms her own pending session — the same effect as a parent
 * confirming via the WhatsApp offer link, just from her own portal.
 * Selects back the updated row rather than trusting a null error: an
 * .update() that matches zero rows still reports no error, so without this
 * check a session that's no longer 'pending' (declined by the parent,
 * cancelled/reset by the owner, or already confirmed a moment ago while her
 * screen was stale) would silently no-op and look like "Confirm did
 * nothing" with no explanation.
 */
export async function confirmSession(sessionId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const { data, error } = await supabase
    .from('session_plans')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('teacher_id', user.id)
    .eq('status', 'pending')
    .select('id')

  if (error) return { error: 'Could not confirm session.' }
  if (!data || data.length === 0) {
    return { error: "This session isn't pending anymore — it may have been cancelled or changed elsewhere. Refresh to see its current status." }
  }

  revalidatePath('/teacher')
  return { error: null }
}

/**
 * Confirms every pending session in one go — same effect as confirmSession,
 * just batched so the teacher isn't clicking Confirm one row at a time.
 * Reports how many of the requested ids weren't actually confirmed (same
 * "no longer pending" reasons as confirmSession), instead of silently
 * declaring success when some rows didn't match.
 */
export async function confirmAllSessions(sessionIds: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }
  if (sessionIds.length === 0) return { error: null }

  const { data, error } = await supabase
    .from('session_plans')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .in('id', sessionIds)
    .eq('teacher_id', user.id)
    .eq('status', 'pending')
    .select('id')

  if (error) return { error: 'Could not confirm sessions.' }

  revalidatePath('/teacher')
  const skipped = sessionIds.length - (data?.length ?? 0)
  if (skipped > 0) {
    return {
      error: `Confirmed ${data?.length ?? 0} of ${sessionIds.length} — ${skipped} ${skipped === 1 ? 'was' : 'were'} no longer pending (cancelled or changed elsewhere). Refresh to see current status.`,
    }
  }
  return { error: null }
}

/**
 * Teacher declines her own pending session — she couldn't confirm it before
 * the owner ever assigned it, e.g. a schedule conflict or a qualification
 * mismatch she needs to flag. Same target status ('declined') the parent-
 * facing offer flow already uses, so it plugs into the existing "unmet
 * needs reopen automatically" mechanism (getUnmetNeeds excludes anything
 * not pending/accepted/completed) with no new plumbing — the owner just
 * sees the need reappear on the Recommendation page. Logged to audit_log
 * with the optional reason since nothing else would otherwise tell the
 * owner this happened or why.
 */
export async function declineSession(sessionId: string, reason: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const { data, error } = await supabase
    .from('session_plans')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('teacher_id', user.id)
    .eq('status', 'pending')
    .select('id')

  if (error) return { error: 'Could not decline session.' }
  if (!data || data.length === 0) {
    return { error: "This session isn't pending anymore — it may have been cancelled or changed elsewhere. Refresh to see its current status." }
  }

  logAudit(supabase, user.id, 'decline_session', 'session_plan', sessionId, reason ? { reason } : undefined)

  revalidatePath('/teacher')
  return { error: null }
}

/**
 * Marks a specific week's occurrence of a weekly-recurring session as
 * delivered — the per-occurrence record a standing weekly session_plans row
 * has no other way to carry (see session_occurrences). Self-declared by the
 * teacher, same trust model as completing a one-off session. Idempotent: if
 * already marked, this just succeeds without changing anything.
 */
export async function completeWeeklyOccurrence(sessionPlanId: string, weekStartDate: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const { data: session } = await supabase
    .from('session_plans')
    .select('id, day_of_week, recurrence_type, status')
    .eq('id', sessionPlanId)
    .eq('teacher_id', user.id)
    .single()

  if (!session || session.recurrence_type !== 'weekly' || session.status !== 'accepted' || session.day_of_week === null) {
    return { error: 'Session not found.' }
  }

  const occurrenceDate = dateForDayOfWeek(weekStartDate, session.day_of_week)
  if (occurrenceDate > dateStringInBusinessTz(new Date())) {
    return { error: "Can't mark a session complete before it happens." }
  }

  const { error } = await supabase.from('session_occurrences').insert({ session_plan_id: sessionPlanId, week_start_date: weekStartDate })

  if (error && error.code !== '23505') return { error: 'Could not mark session complete.' }

  revalidatePath('/teacher')
  revalidatePath('/teacher/commissions')
  return { error: null }
}

/**
 * Marks a session delivered. Only one-off sessions are completable — a
 * weekly-recurring row is a standing commitment with no single occurrence to
 * mark done. This is what a protocol's monthly coverage (Reports) actually
 * gates on for one-off sessions, so it matters for real reporting, not just
 * a checkbox.
 */
export async function completeSession(sessionId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const { data, error } = await supabase
    .from('session_plans')
    .update({ status: 'completed', responded_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('teacher_id', user.id)
    .eq('status', 'accepted')
    .eq('recurrence_type', 'one_off')
    .select('id')

  if (error) return { error: 'Could not complete session.' }
  if (!data || data.length === 0) {
    return { error: "This session isn't in accepted status anymore — it may have been cancelled or changed elsewhere. Refresh to see its current status." }
  }

  revalidatePath('/teacher')
  return { error: null }
}
