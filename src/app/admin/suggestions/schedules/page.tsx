import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'
import { SuggestionsNav } from '../suggestions-nav'
import { SchedulesList, type ScheduleBatchWithSessions } from './schedules-list'

const dateLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TIMEZONE })
const timeLabelFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TIMEZONE })

export default async function SchedulesPage() {
  const supabase = await createClient()

  const [{ data: batches }, { data: sessionRows }] = await Promise.all([
    supabase.from('schedule_batches').select('*').order('created_at', { ascending: false }),
    supabase
      .from('session_plans')
      .select(
        'id, schedule_batch_id, start_time, students(name, profiles!students_parent_id_fkey(phone)), profiles!session_plans_teacher_id_fkey(name), protocols(title)'
      )
      .not('schedule_batch_id', 'is', null)
      .in('status', ['pending', 'accepted']),
  ])

  const sessionsByBatch = new Map<string, ScheduleBatchWithSessions['sessions']>()
  for (const row of sessionRows ?? []) {
    if (!row.schedule_batch_id) continue
    const student = Array.isArray(row.students) ? row.students[0] : row.students
    const parent = Array.isArray(student?.profiles) ? student?.profiles[0] : student?.profiles
    const teacher = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const protocol = Array.isArray(row.protocols) ? row.protocols[0] : row.protocols
    const when = row.start_time
      ? `${dateLabelFormatter.format(new Date(row.start_time))} ${timeLabelFormatter.format(new Date(row.start_time))}`
      : 'Unknown time'

    const arr = sessionsByBatch.get(row.schedule_batch_id) ?? []
    arr.push({
      id: row.id,
      studentName: student?.name ?? 'Unknown student',
      protocolName: protocol?.title ?? 'Unknown protocol',
      teacherName: teacher?.name ?? 'Unknown teacher',
      when,
      hasPhone: Boolean(parent?.phone),
    })
    sessionsByBatch.set(row.schedule_batch_id, arr)
  }

  const withSessions: ScheduleBatchWithSessions[] = (batches ?? []).map((b) => ({
    ...b,
    sessions: sessionsByBatch.get(b.id) ?? [],
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
