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
 * Writes params into the therapy_notes row for this occurrence, at the given
 * status — inserting it the first time, updating in place on every save
 * after that (a draft saved more than once, or a draft being finalized), so
 * the unique index on (session_plan_id[, week_start_date]) never sees a
 * second insert for the same occurrence.
 */
async function upsertTherapyNote(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string,
  params: SubmitTherapyNoteParams,
  status: 'draft' | 'submitted' | 'accepted'
) {
  let existingQuery = supabase
    .from('therapy_notes')
    .select('id')
    .eq('session_plan_id', params.sessionPlanId)
    .eq('teacher_id', teacherId)
  existingQuery = params.weekStartDate ? existingQuery.eq('week_start_date', params.weekStartDate) : existingQuery.is('week_start_date', null)
  const { data: existing } = await existingQuery.maybeSingle()

  const noteFields = {
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
    status,
    updated_at: new Date().toISOString(),
  }

  const { error } = existing
    ? await supabase.from('therapy_notes').update(noteFields).eq('id', existing.id)
    : await supabase.from('therapy_notes').insert({
        session_plan_id: params.sessionPlanId,
        week_start_date: params.weekStartDate,
        teacher_id: teacherId,
        ...noteFields,
      })

  if (error) {
    if (error.code === '23505') return { error: 'A note for this session already exists.' }
    return { error: 'Could not save the note.' }
  }
  return { error: null }
}

/**
 * Saves progress on a note without sending it anywhere — no session
 * completion, no owner queue, no parent visibility. Only meaningful for a
 * teacher flagged for review (see requires_note_review): she can come back
 * to "Write note" for the same occurrence and keep editing until she's ready
 * to submit.
 */
export async function saveTherapyNoteDraft(params: SubmitTherapyNoteParams) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const result = await upsertTherapyNote(supabase, user.id, params, 'draft')
  if (result.error) return result

  revalidatePath('/teacher/therapy-notes')
  return { error: null }
}

/**
 * Finalizes the therapy note for one occurrence, then marks that occurrence
 * complete the normal way — completeSession for a one-off,
 * completeWeeklyOccurrence for a weekly session's specific week. The note is
 * the gate: the teacher portal has no other path to mark a session complete
 * without going through this first (see schedule-calendar.tsx, which links
 * here instead of calling those directly). A teacher not flagged for review
 * (see admin/teachers) publishes straight to 'accepted'; everyone else lands
 * at 'submitted' and needs the owner's accept/send-back before a parent can
 * see it.
 */
export async function submitTherapyNote(params: SubmitTherapyNoteParams) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { data: profile } = await supabase.from('profiles').select('requires_note_review').eq('id', user.id).single()
  const finalStatus = profile?.requires_note_review === false ? 'accepted' : 'submitted'

  const noteResult = await upsertTherapyNote(supabase, user.id, params, finalStatus)
  if (noteResult.error) return noteResult

  const result = params.weekStartDate
    ? await completeWeeklyOccurrence(params.sessionPlanId, params.weekStartDate)
    : await completeSession(params.sessionPlanId)

  if (result.error) return { error: `Note saved, but could not mark the session complete: ${result.error}` }

  revalidatePath('/teacher')
  revalidatePath('/teacher/therapy-notes')
  return { error: null }
}

/**
 * Revises a note the owner sent back — same fields as submitTherapyNote minus
 * the identifiers that never change, plus it puts the note back to
 * 'submitted' for a second look. Doesn't touch session completion; that
 * already happened when the note was first submitted.
 */
export async function resubmitTherapyNote(noteId: string, params: Omit<SubmitTherapyNoteParams, 'sessionPlanId' | 'weekStartDate'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { error } = await supabase
    .from('therapy_notes')
    .update({
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
      status: 'submitted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .eq('teacher_id', user.id)

  if (error) return { error: 'Could not resubmit the note.' }

  revalidatePath('/teacher/therapy-notes')
  revalidatePath('/admin/therapy-notes')
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
