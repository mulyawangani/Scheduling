'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import type { RecurrenceType } from '@/lib/supabase/types'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { computeMatchScore, conflictWindow, findTeachersAtSlot, type TimeSlotCandidate } from '@/lib/matching/suggest'
import { checkCapacity, type CapacityCheck } from '@/lib/matching/capacity'
import { BUSINESS_TIMEZONE, businessLocalToISOString, dateStringInBusinessTz } from '@/lib/timezone'
import { logAudit } from '@/lib/audit'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: BUSINESS_TIMEZONE,
})

interface AssignParams {
  studentId: string
  protocolId: string
  teacherId: string
  recurrenceType: RecurrenceType
  dayOfWeek?: number
  timeOfDayStart?: string
  timeOfDayEnd?: string
  startTime?: string
  endTime?: string
  source: 'algorithm' | 'manual'
  note?: string
  /** Tags the row so a later bulk "WhatsApp push" (see schedules/actions.ts) knows which sessions belong together. */
  scheduleBatchId?: string
  /** false skips the per-booking WhatsApp send entirely — used by Create Schedule, which defers notifying until the owner pushes the whole batch at once. Defaults to true. */
  notify?: boolean
}

export async function createSessionPlan(params: AssignParams) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const proposedWindow = conflictWindow({
    recurrence_type: params.recurrenceType,
    start_time: params.recurrenceType === 'one_off' ? (params.startTime ?? null) : null,
    end_time: params.recurrenceType === 'one_off' ? (params.endTime ?? null) : null,
    day_of_week: params.recurrenceType === 'weekly' ? (params.dayOfWeek ?? null) : null,
    time_of_day_start: params.recurrenceType === 'weekly' ? (params.timeOfDayStart ?? null) : null,
    time_of_day_end: params.recurrenceType === 'weekly' ? (params.timeOfDayEnd ?? null) : null,
  })

  // Capacity and match-score are independent reads, so run them together
  // instead of back-to-back — capacity still gates the insert below, the
  // match-score compute is just wasted (cheap) on the rare rejected case.
  const proposedDate =
    proposedWindow && params.recurrenceType === 'one_off' && params.startTime
      ? dateStringInBusinessTz(new Date(params.startTime))
      : undefined
  const [capacity, matchScore] = await Promise.all([
    proposedWindow ? checkCapacity(supabase, proposedWindow, proposedDate) : Promise.resolve<CapacityCheck>({ ok: true }),
    computeMatchScore(supabase, params.studentId, params.teacherId, params.protocolId),
  ])
  if (!capacity.ok) return { error: capacity.error }

  const { data: plan, error } = await supabase
    .from('session_plans')
    .insert({
      student_id: params.studentId,
      protocol_id: params.protocolId,
      teacher_id: params.teacherId,
      owner_id: user.id,
      recurrence_type: params.recurrenceType,
      day_of_week: params.recurrenceType === 'weekly' ? params.dayOfWeek : null,
      time_of_day_start: params.recurrenceType === 'weekly' ? params.timeOfDayStart : null,
      time_of_day_end: params.recurrenceType === 'weekly' ? params.timeOfDayEnd : null,
      start_time: params.recurrenceType === 'one_off' ? params.startTime : null,
      end_time: params.recurrenceType === 'one_off' ? params.endTime : null,
      source: params.source,
      match_score: matchScore,
      note: params.note || null,
      schedule_batch_id: params.scheduleBatchId ?? null,
    })
    .select('token')
    .single()

  // A duplicate booking of the exact same student/teacher/protocol/time
  // (e.g. retrying "Book all" after a refresh interrupted it) hits the
  // session_plans_*_dedupe_uidx partial unique index — treat that as a
  // harmless no-op rather than a real failure, since the session is already
  // booked either way.
  if (error?.code === '23505') {
    revalidatePath('/admin/suggestions')
    return { error: null, whatsappError: null, duplicate: true }
  }
  if (error || !plan) return { error: `Could not create session: ${error?.message}` }

  // Create Schedule books everything with notify:false and pushes WhatsApp
  // later, as one deliberate bulk action from the Schedules tab — so skip
  // the per-session lookups and send entirely here.
  if (params.notify === false) {
    revalidatePath('/admin/suggestions')
    return { error: null, whatsappError: null }
  }

  const [{ data: details }, { data: teacher }, { data: protocol }] = await Promise.all([
    supabase.from('students').select('name, profiles!students_parent_id_fkey(name, phone)').eq('id', params.studentId).single(),
    supabase.from('profiles').select('name').eq('id', params.teacherId).single(),
    supabase.from('protocols').select('title').eq('id', params.protocolId).single(),
  ])

  const parent = Array.isArray(details?.profiles) ? details?.profiles[0] : details?.profiles
  const when =
    params.recurrenceType === 'one_off' && params.startTime
      ? dateFormatter.format(new Date(params.startTime))
      : `every ${DAYS[params.dayOfWeek ?? 0]} ${params.timeOfDayStart?.slice(0, 5)}`

  // The WhatsApp send is a real network call to Twilio (regularly the
  // slowest single step here) — deferring it via after() lets the response
  // go back to the browser as soon as the booking itself is committed,
  // instead of making the owner's "Book all" wait on 45 sequential Twilio
  // round-trips. Vercel keeps the function alive to finish it in the
  // background; the caller no longer gets a synchronous send/fail result.
  const whatsappError = parent?.phone ? null : 'Parent has no phone number on file.'
  if (parent?.phone) {
    const link = `${process.env.NEXT_PUBLIC_SITE_URL}/offer/${plan.token}`
    const message = `Hi ${parent.name}, a session for ${details?.name} (${protocol?.title} with ${teacher?.name}) is proposed for ${when}. Confirm here: ${link}`
    after(() => sendWhatsAppMessage(parent.phone!, message))
  }

  revalidatePath('/admin/suggestions')
  return { error: null, whatsappError }
}

export async function approveSuggestion(
  studentId: string,
  protocolId: string,
  teacherId: string,
  dayOfWeek: number,
  timeOfDayStart: string,
  timeOfDayEnd: string
) {
  return createSessionPlan({
    studentId,
    protocolId,
    teacherId,
    recurrenceType: 'weekly',
    dayOfWeek,
    timeOfDayStart,
    timeOfDayEnd,
    source: 'algorithm',
  })
}

/** Backs the "browse other times" picker on the assign screen — which qualified teachers are free at a day/time the owner picked by hand, beyond whatever suggestTeachers already surfaced. */
export async function findTeachersAtTime(
  studentId: string,
  protocolId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  weekStartDate?: string
): Promise<{ candidates: TimeSlotCandidate[]; error: string | null }> {
  const supabase = await createClient()
  return weekStartDate
    ? findTeachersAtSlot(supabase, studentId, protocolId, { dayOfWeek, startTime, endTime }, weekStartDate)
    : findTeachersAtSlot(supabase, studentId, protocolId, { dayOfWeek, startTime, endTime })
}

export async function manualAssign(studentId: string, protocolId: string, formData: FormData) {
  const teacherId = String(formData.get('teacherId') || '')
  const recurrenceType = String(formData.get('recurrenceType') || '') as RecurrenceType
  const note = String(formData.get('note') || '')

  if (!teacherId || !recurrenceType) {
    return { error: 'Teacher and recurrence type are required.' }
  }

  if (recurrenceType === 'weekly') {
    const day = formData.get('day')
    const timeStart = String(formData.get('timeOfDayStart') || '')
    const timeEnd = String(formData.get('timeOfDayEnd') || '')
    if (day === null || day === '' || !timeStart || !timeEnd) {
      return { error: 'Day, start time, and end time are required for a weekly session.' }
    }
    return createSessionPlan({
      studentId,
      protocolId,
      teacherId,
      recurrenceType: 'weekly',
      dayOfWeek: Number(day),
      timeOfDayStart: timeStart,
      timeOfDayEnd: timeEnd,
      source: 'manual',
      note,
      // Manual assignments notify later, in one deliberate push from the
      // Schedules tab — not the moment they're booked. Leaves the session
      // unbatched; "Add to Schedules" on the Simulations page sweeps it (and
      // anything else unbatched) into a batch whenever the owner's ready.
      notify: false,
    })
  }

  const startTime = String(formData.get('startTime') || '')
  const endTime = String(formData.get('endTime') || '')
  if (!startTime || !endTime) {
    return { error: 'Start and end time are required for a one-off session.' }
  }
  return createSessionPlan({
    studentId,
    protocolId,
    teacherId,
    recurrenceType: 'one_off',
    startTime: businessLocalToISOString(startTime),
    endTime: businessLocalToISOString(endTime),
    source: 'manual',
    note,
    notify: false,
  })
}

/** Cancels a booked session — same soft-delete pattern as the parent's own cancel action. */
export async function deleteSession(sessionId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('session_plans')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('id', sessionId)
    .in('status', ['pending', 'accepted'])

  if (error) return { error: 'Could not delete session.' }

  revalidatePath('/admin/suggestions')
  return { error: null }
}

/** Permanently removes a student's protocol need — all underlying rows in the group (e.g. every needed sub-protocol under one protocol), since they're booked as a single session. */
export async function deleteNeeds(needIds: string[]) {
  const supabase = await createClient()
  const { error } = await supabase.from('student_protocols').delete().in('id', needIds)

  if (error) return { error: 'Could not clear need.' }

  revalidatePath('/admin/suggestions')
  return { error: null }
}

/**
 * Full reset: cancels every active session for every teacher and clears
 * every temporarily-prioritized (starred) need, system-wide, so Generate
 * Schedule can be run again from a clean slate.
 */
export async function resetAllSchedules() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: cancelled, error: sessionsError } = await supabase
    .from('session_plans')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .in('status', ['pending', 'accepted'])
    .select('id')

  if (sessionsError) return { error: 'Could not clear sessions.' }

  const { error: prioritizedError } = await supabase.from('prioritized_needs').delete().not('student_id', 'is', null)

  if (prioritizedError) return { error: 'Sessions cleared, but could not clear prioritized needs.' }

  if (user) logAudit(supabase, user.id, 'reset_all_schedules', undefined, undefined, { sessionsCancelled: cancelled?.length ?? 0 })

  revalidatePath('/', 'layout')
  return { error: null }
}

/**
 * Commits one row from a generated schedule preview — nothing is booked until
 * this is called. Notification is deferred rather than sent here: the owner
 * pushes WhatsApp confirmations as one deliberate batch from the Schedules
 * tab (see "Add to Schedules"), so booking a proposal shouldn't also fire an
 * immediate per-session message — that would double-notify parents once the
 * batch push runs, and the 3 extra lookups notify:true does per session
 * (parent/teacher/protocol) only slow down "Book all" for no reason here.
 */
export async function commitSimulatedSession(
  studentId: string,
  protocolId: string,
  teacherId: string,
  date: string,
  startTime: string,
  endTime: string
) {
  return createSessionPlan({
    studentId,
    protocolId,
    teacherId,
    recurrenceType: 'one_off',
    startTime: businessLocalToISOString(`${date}T${startTime}`),
    endTime: businessLocalToISOString(`${date}T${endTime}`),
    source: 'algorithm',
    notify: false,
  })
}

/**
 * "Book all" as ONE server round-trip instead of one per proposal — the
 * browser used to call commitSimulatedSession in a client-side loop, paying
 * full network latency (and, before notify was made async, a Twilio call
 * too) on every single proposal. Still books sequentially, same as before:
 * capacity is checked then written non-atomically, so two proposals booking
 * concurrently could both pass a capacity check for the same slot before
 * either has written. Notifies per session as it books, same as individual
 * Book/Book all always have — unlike Create Schedule, which defers it.
 */
export async function commitAllSimulatedSessions(
  proposals: { studentId: string; protocolId: string; teacherId: string; date: string; startTime: string; endTime: string }[],
  weekStartDate?: string
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const errors: { index: number; error: string }[] = []
  let succeeded = 0
  let duplicates = 0
  for (let i = 0; i < proposals.length; i++) {
    const result = await commitSimulatedSession(
      proposals[i].studentId,
      proposals[i].protocolId,
      proposals[i].teacherId,
      proposals[i].date,
      proposals[i].startTime,
      proposals[i].endTime
    )
    if (result.error) errors.push({ index: i, error: result.error })
    else {
      succeeded++
      if ('duplicate' in result && result.duplicate) duplicates++
    }
  }

  if (user) {
    logAudit(supabase, user.id, 'book_all', 'week', weekStartDate, {
      proposed: proposals.length,
      succeeded,
      duplicates,
      failed: errors.length,
    })
  }

  return { succeeded, errors }
}
