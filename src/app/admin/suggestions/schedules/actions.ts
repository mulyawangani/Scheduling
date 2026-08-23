'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createSessionPlan } from '../actions'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { BUSINESS_TIMEZONE, businessLocalToISOString } from '@/lib/timezone'
import type { ProposedSession } from '@/lib/matching/generate-schedule'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: BUSINESS_TIMEZONE,
})

/**
 * Books every row of a generated schedule preview into real session_plans,
 * tagged under one new schedule_batches row — same underlying booking as
 * "Book all", except notification is deliberately skipped per-session (see
 * notify:false in createSessionPlan) and deferred to a single later
 * "WhatsApp push" from this batch's row on the Schedules tab. Proposals are
 * booked one at a time, sequentially — same reasoning as Book all: capacity
 * is checked-then-written non-atomically, so booking concurrently risks two
 * proposals both passing a capacity check for the same slot before either
 * has written.
 */
export async function createSchedule(weekStartDate: string, proposals: ProposedSession[]) {
  if (proposals.length === 0) return { error: 'Nothing to schedule — there are no proposed sessions.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { count } = await supabase
    .from('schedule_batches')
    .select('id', { count: 'exact', head: true })
    .eq('week_start_date', weekStartDate)
  const label = `Schedule ${(count ?? 0) + 1}`

  const { data: batch, error: batchError } = await supabase
    .from('schedule_batches')
    .insert({ week_start_date: weekStartDate, label, created_by: user.id })
    .select('id')
    .single()
  if (batchError || !batch) return { error: 'Could not create the schedule.' }

  let created = 0
  const errors: string[] = []
  for (const p of proposals) {
    const result = await createSessionPlan({
      studentId: p.studentId,
      protocolId: p.protocolId,
      teacherId: p.teacherId,
      recurrenceType: 'one_off',
      startTime: businessLocalToISOString(`${p.date}T${p.startTime}`),
      endTime: businessLocalToISOString(`${p.date}T${p.endTime}`),
      source: 'algorithm',
      scheduleBatchId: batch.id,
      notify: false,
    })
    if (result.error) errors.push(`${p.studentName} — ${p.protocolName}: ${result.error}`)
    else created++
  }

  revalidatePath('/admin/suggestions')
  revalidatePath('/admin/suggestions/schedules')

  if (created === 0) return { error: `Could not book any sessions. ${errors[0] ?? ''}`.trim() }
  return {
    error: null,
    batchId: batch.id as string,
    created,
    failed: errors.length,
    firstError: errors[0] ?? null,
  }
}

/**
 * Groups already-booked sessions (booked the normal way — Book, Book all,
 * manual assign — which notify per-session as they're created) into a new
 * schedule_batches row, retroactively, so they show up on the Schedules tab
 * for a "WhatsApp push." Doesn't touch anything already tagged with a batch
 * (idempotent-safe to click again — only unbatched sessions get claimed).
 * Grouping only, never creates or re-books a session.
 */
export async function addExistingSessionsToSchedule(weekStartDate: string, sessionIds: string[]) {
  if (sessionIds.length === 0) return { error: 'No sessions to add.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { count } = await supabase
    .from('schedule_batches')
    .select('id', { count: 'exact', head: true })
    .eq('week_start_date', weekStartDate)
  const label = `Schedule ${(count ?? 0) + 1}`

  const { data: batch, error: batchError } = await supabase
    .from('schedule_batches')
    .insert({ week_start_date: weekStartDate, label, created_by: user.id })
    .select('id')
    .single()
  if (batchError || !batch) return { error: 'Could not create the schedule.' }

  const { data: updated, error: updateError } = await supabase
    .from('session_plans')
    .update({ schedule_batch_id: batch.id })
    .in('id', sessionIds)
    .is('schedule_batch_id', null)
    .select('id')

  if (updateError) return { error: 'Could not add sessions to the schedule.' }

  revalidatePath('/admin/suggestions')
  revalidatePath('/admin/suggestions/schedules')
  return { error: null, batchId: batch.id as string, added: updated?.length ?? 0 }
}

/**
 * Sends the WhatsApp confirmation for every session in one schedule batch,
 * in one deliberate push — unlike per-booking sends (which fire individually
 * as each session is created), this is a single owner-triggered action, so
 * sending all of them in parallel is safe (no capacity writes involved,
 * just reads + outbound messages).
 */
export async function pushWhatsAppForBatch(batchId: string) {
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('session_plans')
    .select(
      'id, token, recurrence_type, start_time, day_of_week, time_of_day_start, students(name, profiles!students_parent_id_fkey(name, phone)), profiles!session_plans_teacher_id_fkey(name), protocols(title)'
    )
    .eq('schedule_batch_id', batchId)
    .in('status', ['pending', 'accepted'])

  if (error) return { error: 'Could not load this schedule.' }
  if (!rows || rows.length === 0) return { error: 'No sessions in this schedule.' }

  const results = await Promise.all(
    rows.map(async (row) => {
      const student = Array.isArray(row.students) ? row.students[0] : row.students
      const parent = Array.isArray(student?.profiles) ? student?.profiles[0] : student?.profiles
      const teacher = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const protocol = Array.isArray(row.protocols) ? row.protocols[0] : row.protocols

      if (!parent?.phone) return { ok: false as const, reason: 'no_phone' as const }

      const when =
        row.recurrence_type === 'one_off' && row.start_time
          ? dateFormatter.format(new Date(row.start_time))
          : `every ${DAYS[row.day_of_week ?? 0]} ${row.time_of_day_start?.slice(0, 5)}`
      const link = `${process.env.NEXT_PUBLIC_SITE_URL}/offer/${row.token}`
      const message = `Hi ${parent.name}, a session for ${student?.name} (${protocol?.title} with ${teacher?.name}) is proposed for ${when}. Confirm here: ${link}`
      const result = await sendWhatsAppMessage(parent.phone, message)
      return result.error ? { ok: false as const, reason: 'send_failed' as const } : { ok: true as const }
    })
  )

  const sent = results.filter((r) => r.ok).length
  const noPhone = results.filter((r) => !r.ok && r.reason === 'no_phone').length
  const failed = results.filter((r) => !r.ok && r.reason === 'send_failed').length

  await supabase.from('schedule_batches').update({ whatsapp_pushed_at: new Date().toISOString() }).eq('id', batchId)

  revalidatePath('/admin/suggestions/schedules')
  return { error: null, sent, noPhone, failed }
}

/**
 * Removes a schedule batch grouping — never touches the underlying
 * session_plans rows. Their schedule_batch_id just goes back to null
 * (on delete set null), so the sessions themselves stay exactly as booked;
 * they simply become unbatched again, same as any newly-booked session that
 * hasn't been added to a schedule yet.
 */
export async function deleteScheduleBatch(batchId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('schedule_batches').delete().eq('id', batchId)

  if (error) return { error: 'Could not delete this schedule.' }

  revalidatePath('/admin/suggestions/schedules')
  return { error: null }
}
