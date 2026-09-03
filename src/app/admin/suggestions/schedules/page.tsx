import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { BUSINESS_TIMEZONE, dateStringInBusinessTz, dayOfWeekInBusinessTz, formatTimeInBusinessTz } from '@/lib/timezone'
import { dateForDayOfWeek } from '@/lib/week'
import { SuggestionsNav } from '../suggestions-nav'
import { SchedulesList, type ScheduleBatchWithSessions } from './schedules-list'
import type { GridSession } from './actual-sessions-grid'

const dateLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TIMEZONE })
const timeLabelFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TIMEZONE })
const DAY_NAMES: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' }

export default async function SchedulesPage() {
  const supabase = await createClient()

  const [{ data: batches }, { data: sessionRows }, { data: activeSessions }] = await Promise.all([
    supabase.from('schedule_batches').select('*').order('created_at', { ascending: false }),
    supabase
      .from('session_plans')
      .select(
        'id, schedule_batch_id, recurrence_type, start_time, day_of_week, time_of_day_start, students(name, profiles!students_parent_id_fkey(phone)), profiles!session_plans_teacher_id_fkey(name), protocols(title)'
      )
      .not('schedule_batch_id', 'is', null)
      .in('status', ['pending', 'accepted']),
    // Every real booked session, batch-tagged or not — used to show what's
    // actually on the calendar for a batch's week, since a batch's own
    // "sessions" count only reflects what's tagged into it.
    supabase
      .from('session_plans')
      .select(
        'id, recurrence_type, start_time, end_time, day_of_week, time_of_day_start, status, students(name), profiles!session_plans_teacher_id_fkey(name), protocols(title)'
      )
      .in('status', ['pending', 'accepted', 'completed']),
  ])

  const toMinutes = (hhmmss: string) => {
    const [h, m] = hhmmss.split(':').map(Number)
    return h * 60 + m
  }

  // Buckets a session into every week it applies to: a one-off only counts
  // for the specific week its date falls in, a weekly-recurring session
  // applies to any week (it has no date of its own), so it's stamped into
  // every distinct week a batch actually needs. Built first (before the
  // per-batch session list below) because both need the SAME S-number per
  // session, assigned once here from the full, chronologically-sorted set —
  // not two independently-computed numberings that could disagree.
  const distinctWeeks = Array.from(new Set((batches ?? []).map((b) => b.week_start_date)))
  const actualByWeek = new Map<string, GridSession[]>()
  const labelById = new Map<string, string>()
  for (const weekStartDate of distinctWeeks) {
    const fridayDate = dateForDayOfWeek(weekStartDate, 5)
    const rows: (GridSession & { sortDay: number; sortMinutes: number })[] = []
    for (const s of activeSessions ?? []) {
      const student = Array.isArray(s.students) ? s.students[0] : s.students
      const teacher = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
      const protocol = Array.isArray(s.protocols) ? s.protocols[0] : s.protocols
      const base = {
        id: s.id,
        status: s.status,
        studentName: student?.name ?? 'Unknown student',
        teacherName: teacher?.name ?? 'Unknown teacher',
        protocolName: protocol?.title ?? 'Unknown protocol',
      }
      if (s.recurrence_type === 'weekly') {
        if (s.day_of_week === null || !s.time_of_day_start) continue
        rows.push({ ...base, dayOfWeek: s.day_of_week, startTime: s.time_of_day_start.slice(0, 5), label: '', sortDay: s.day_of_week, sortMinutes: toMinutes(s.time_of_day_start) })
        continue
      }
      if (!s.start_time) continue
      const d = dateStringInBusinessTz(new Date(s.start_time))
      if (d < weekStartDate || d > fridayDate) continue
      const dow = dayOfWeekInBusinessTz(new Date(s.start_time))
      const startTime = formatTimeInBusinessTz(new Date(s.start_time)).slice(0, 5)
      rows.push({ ...base, dayOfWeek: dow, startTime, label: '', sortDay: dow, sortMinutes: toMinutes(startTime) })
    }
    // Same order the grid renders in (Mon→Fri, top→bottom by hour) — S1 is
    // always the week's earliest Monday session, regardless of query order.
    rows.sort((a, b) => a.sortDay - b.sortDay || a.sortMinutes - b.sortMinutes)
    rows.forEach((r, i) => {
      r.label = `S${i + 1}`
      labelById.set(r.id, r.label)
    })
    actualByWeek.set(weekStartDate, rows)
  }

  const sessionsByBatch = new Map<string, ScheduleBatchWithSessions['sessions']>()
  for (const row of sessionRows ?? []) {
    if (!row.schedule_batch_id) continue
    const student = Array.isArray(row.students) ? row.students[0] : row.students
    const parent = Array.isArray(student?.profiles) ? student?.profiles[0] : student?.profiles
    const teacher = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const protocol = Array.isArray(row.protocols) ? row.protocols[0] : row.protocols

    // A weekly-recurring session has no start_time at all by design (see the
    // recurrence_type check constraint) — it only ever has day_of_week +
    // time_of_day_start. Reading start_time alone (as this used to) meant
    // every weekly session showed "Unknown time" even though the grid below
    // renders its time correctly from these same columns.
    let when: string
    let sortDay: number
    let sortMinutes: number
    if (row.recurrence_type === 'weekly' && row.day_of_week !== null && row.time_of_day_start) {
      sortDay = row.day_of_week
      sortMinutes = toMinutes(row.time_of_day_start)
      when = `${DAY_NAMES[row.day_of_week]} ${row.time_of_day_start.slice(0, 5)} (weekly)`
    } else if (row.start_time) {
      const d = new Date(row.start_time)
      sortDay = dayOfWeekInBusinessTz(d)
      sortMinutes = toMinutes(formatTimeInBusinessTz(d))
      when = `${DAY_NAMES[sortDay]} ${dateLabelFormatter.format(d)} ${timeLabelFormatter.format(d)}`
    } else {
      sortDay = 7
      sortMinutes = 0
      when = 'Unknown time'
    }

    const arr = sessionsByBatch.get(row.schedule_batch_id) ?? []
    arr.push({
      id: row.id,
      label: labelById.get(row.id) ?? '—',
      studentName: student?.name ?? 'Unknown student',
      protocolName: protocol?.title ?? 'Unknown protocol',
      teacherName: teacher?.name ?? 'Unknown teacher',
      when,
      hasPhone: Boolean(parent?.phone),
      sortDay,
      sortMinutes,
    })
    sessionsByBatch.set(row.schedule_batch_id, arr)
  }

  // Sort to match the grid below: Mon→Fri, then chronologically — instead of
  // whatever order the query happened to return, which made it hard to line
  // a row up with the cell it corresponds to.
  for (const arr of sessionsByBatch.values()) {
    arr.sort((a, b) => a.sortDay - b.sortDay || a.sortMinutes - b.sortMinutes)
  }

  const withSessions: ScheduleBatchWithSessions[] = (batches ?? []).map((b) => ({
    ...b,
    sessions: sessionsByBatch.get(b.id) ?? [],
    actualSessions: actualByWeek.get(b.week_start_date) ?? [],
  }))

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Scheduling</h1>
      <SuggestionsNav active="/admin/suggestions/schedules" />

      <p className="mb-4 text-sm text-gray-500">
        Every schedule booked via &quot;Create schedule&quot; on the Simulations tab — each one is real, already on
        the calendar. Notifying parents is a separate step from here: &quot;WhatsApp push&quot; sends every
        session&apos;s confirmation message in one go, whenever you&apos;re ready, rather than the moment each
        session is booked.
      </p>

      {withSessions.length === 0 ? (
        <p className="text-sm text-gray-500">
          No schedules yet — book one from the &quot;Create schedule&quot; button on the Simulations tab.
        </p>
      ) : (
        <SchedulesList batches={withSessions} />
      )}
    </main>
  )
}
