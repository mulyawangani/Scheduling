import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { BackLink } from '@/components/back-link'
import { BUSINESS_TIMEZONE, dateStringInBusinessTz, businessLocalToISOString } from '@/lib/timezone'
import { getWeekStart, dateForDayOfWeek } from '@/lib/week'

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: BUSINESS_TIMEZONE,
})

export default async function TherapyNotesPage() {
  const result = await getUserProfile()
  const supabase = await createClient()
  const teacherId = result!.user.id
  const weekStart = getWeekStart(new Date())
  const todayStr = dateStringInBusinessTz(new Date())

  const { data: sessions } = await supabase
    .from('session_plans')
    .select('id, recurrence_type, start_time, day_of_week, time_of_day_start, status, students(name), protocols(title)')
    .eq('teacher_id', teacherId)
    .eq('status', 'accepted')

  const weeklyIds = (sessions ?? []).filter((s) => s.recurrence_type === 'weekly').map((s) => s.id)
  const { data: occurrenceRows } =
    weeklyIds.length > 0
      ? await supabase.from('session_occurrences').select('session_plan_id').in('session_plan_id', weeklyIds).eq('week_start_date', weekStart)
      : { data: [] }
  const completedWeeklyIds = new Set((occurrenceRows ?? []).map((o) => o.session_plan_id))

  interface AwaitingRow {
    sessionId: string
    weekStartDate: string | null
    studentName: string
    protocolName: string
    whenLabel: string
  }

  const awaiting: AwaitingRow[] = []
  for (const s of sessions ?? []) {
    const student = Array.isArray(s.students) ? s.students[0] : s.students
    const protocol = Array.isArray(s.protocols) ? s.protocols[0] : s.protocols
    if (s.recurrence_type === 'one_off') {
      if (!s.start_time) continue
      awaiting.push({
        sessionId: s.id,
        weekStartDate: null,
        studentName: student?.name ?? 'Unknown student',
        protocolName: protocol?.title ?? 'Unknown protocol',
        whenLabel: dateTimeFormatter.format(new Date(s.start_time)),
      })
    } else {
      if (s.day_of_week === null || !s.time_of_day_start || completedWeeklyIds.has(s.id)) continue
      const occurrenceDate = dateForDayOfWeek(weekStart, s.day_of_week)
      if (occurrenceDate > todayStr) continue
      awaiting.push({
        sessionId: s.id,
        weekStartDate: weekStart,
        studentName: student?.name ?? 'Unknown student',
        protocolName: protocol?.title ?? 'Unknown protocol',
        whenLabel: dateTimeFormatter.format(new Date(businessLocalToISOString(`${occurrenceDate}T${s.time_of_day_start.slice(0, 5)}`))),
      })
    }
  }
  awaiting.sort((a, b) => a.whenLabel.localeCompare(b.whenLabel))

  const { data: recentNotes } = await supabase
    .from('therapy_notes')
    .select(
      'id, session_date, week_start_date, review_label, session_plans(recurrence_type, start_time, day_of_week, time_of_day_start, students(name), protocols(title))'
    )
    .eq('teacher_id', teacherId)
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <BackLink href="/teacher" label="Your sessions" />
        <h1 className="mb-1 text-xl font-semibold">Therapy notes</h1>
        <p className="text-sm text-gray-500">
          A session isn&apos;t marked complete until you&apos;ve written its therapy note — that&apos;s what actually
          delivers the protocol for the month.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Awaiting a note{awaiting.length > 0 ? ` (${awaiting.length})` : ''}
        </h2>
        {awaiting.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing waiting on a note right now.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
            {awaiting.map((a) => (
              <li key={`${a.sessionId}:${a.weekStartDate ?? 'one_off'}`} className="flex items-center justify-between p-3 text-sm">
                <span>
                  {a.studentName} — {a.protocolName}
                  <span className="text-gray-400"> · {a.whenLabel}</span>
                </span>
                <Link
                  href={`/teacher/therapy-notes/${a.sessionId}${a.weekStartDate ? `?week=${a.weekStartDate}` : ''}`}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Write note
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Recent notes</h2>
        {!recentNotes || recentNotes.length === 0 ? (
          <p className="text-sm text-gray-500">No notes written yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
            {recentNotes.map((n) => {
              const sp = Array.isArray(n.session_plans) ? n.session_plans[0] : n.session_plans
              const student = Array.isArray(sp?.students) ? sp?.students[0] : sp?.students
              const protocol = Array.isArray(sp?.protocols) ? sp?.protocols[0] : sp?.protocols
              const whenLabel =
                sp?.recurrence_type === 'one_off' && sp.start_time
                  ? dateTimeFormatter.format(new Date(sp.start_time))
                  : sp?.day_of_week !== undefined && sp?.day_of_week !== null && sp.time_of_day_start && n.week_start_date
                    ? dateTimeFormatter.format(
                        new Date(businessLocalToISOString(`${dateForDayOfWeek(n.week_start_date, sp.day_of_week)}T${sp.time_of_day_start.slice(0, 5)}`))
                      )
                    : dateTimeFormatter.format(new Date(`${n.session_date}T00:00:00Z`))
              return (
                <li key={n.id} className="flex items-center justify-between p-3 text-sm">
                  <span>
                    {student?.name ?? 'Unknown student'} — {protocol?.title ?? 'Unknown protocol'}
                    <span className="text-gray-400"> · {whenLabel}</span>
                  </span>
                  {n.review_label && <span className="shrink-0 text-xs text-gray-400">{n.review_label}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
