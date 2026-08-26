'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { completeSession, completeWeeklyOccurrence } from '../actions'

export interface ObjectiveRow {
  objective: string
  outcome: string
}

export interface SubmitTherapyNoteParams {
  sessionPlanId: string
  weekStartDate: string | null
  sessionDate: string
  startDate: string
  duration: string
  reviewLabel: string
  lastSessionSummary: string
  todaysProtocol: string
  repatterningNotes: string
  activeNotes: string
  parentInstructions: string
  objectives: ObjectiveRow[]
  observations: string
}

/**
 * Records the teacher's therapy note for one occurrence, then marks that
 * occurrence complete the normal way — completeSession for a one-off,
 * completeWeeklyOccurrence for a weekly session's specific week. The note is
 * the gate: the teacher portal has no other path to mark a session complete
 * without going through this first (see schedule-calendar.tsx, which links
 * here instead of calling those directly).
 */
export async function submitTherapyNote(params: SubmitTherapyNoteParams) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { error: noteError } = await supabase.from('therapy_notes').insert({
    session_plan_id: params.sessionPlanId,
    week_start_date: params.weekStartDate,
    teacher_id: user.id,
    session_date: params.sessionDate,
    start_date: params.startDate || null,
    duration: params.duration || null,
    review_label: params.reviewLabel || null,
    last_session_summary: params.lastSessionSummary || null,
    todays_protocol: params.todaysProtocol || null,
    repatterning_notes: params.repatterningNotes || null,
    active_notes: params.activeNotes || null,
    parent_instructions: params.parentInstructions || null,
    objectives: params.objectives.filter((o) => o.objective.trim() || o.outcome.trim()),
    observations: params.observations || null,
  })

  if (noteError) {
    if (noteError.code === '23505') return { error: 'A note for this session already exists.' }
    return { error: 'Could not save the note.' }
  }

  const result = params.weekStartDate
    ? await completeWeeklyOccurrence(params.sessionPlanId, params.weekStartDate)
    : await completeSession(params.sessionPlanId)

  if (result.error) return { error: `Note saved, but could not mark the session complete: ${result.error}` }

  revalidatePath('/teacher')
  revalidatePath('/teacher/therapy-notes')
  return { error: null }
}

/**
 * Lets a teacher revise the homework on an already-submitted note, without
 * waiting for the next session — e.g. adding a new exercise or correcting
 * one mid-week. Bumps updated_at so the parent app can tell this apart from
 * the note's original write; the parent's "Homework reminder" always reads
 * the single most recent note across all of a child's sessions, so an edit
 * here is what actually changes what she sees.
 */
export async function updateHomework(noteId: string, parentInstructions: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { error } = await supabase
    .from('therapy_notes')
    .update({ parent_instructions: parentInstructions || null, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('teacher_id', user.id)

  if (error) return { error: 'Could not update homework.' }

  revalidatePath('/teacher/therapy-notes')
  return { error: null }
}
