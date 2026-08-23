'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Teacher confirms her own pending session — the same effect as a parent confirming via the WhatsApp offer link, just from her own portal. */
export async function confirmSession(sessionId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const { error } = await supabase
    .from('session_plans')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('teacher_id', user.id)
    .eq('status', 'pending')

  if (error) return { error: 'Could not confirm session.' }

  revalidatePath('/teacher')
  return { error: null }
}

/** Confirms every pending session in one go — same effect as confirmSession, just batched so the teacher isn't clicking Confirm one row at a time. */
export async function confirmAllSessions(sessionIds: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }
  if (sessionIds.length === 0) return { error: null }

  const { error } = await supabase
    .from('session_plans')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .in('id', sessionIds)
    .eq('teacher_id', user.id)
    .eq('status', 'pending')

  if (error) return { error: 'Could not confirm sessions.' }

  revalidatePath('/teacher')
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

  const { error } = await supabase
    .from('session_plans')
    .update({ status: 'completed', responded_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('teacher_id', user.id)
    .eq('status', 'accepted')
    .eq('recurrence_type', 'one_off')

  if (error) return { error: 'Could not complete session.' }

  revalidatePath('/teacher')
  return { error: null }
}
