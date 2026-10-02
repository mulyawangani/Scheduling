import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import {
  BUSINESS_TIMEZONE,
  dateStringInBusinessTz,
  dayOfWeekInBusinessTz,
  formatTimeInBusinessTz,
} from '@/lib/timezone'
import { getWeekStart, getUpcomingWeekStart, formatWeekLabel, dateForDayOfWeek } from '@/lib/week'
import { ScheduleCalendar, type TeacherSessionRow, type CompletedOccurrence } from './schedule-calendar'

export const dynamic = 'force-dynamic'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

function greeting() {
  const h = parseInt(
    new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: BUSINESS_TIMEZONE })
  )
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default async function TeacherDashboard() {
  const result = await getUserProfile()
  const supabase = await createClient()

  const todayStr = dateStringInBusinessTz(new Date())
  const todayDow = dayOfWeekInBusinessTz(new Date())
  const currentWeekStart = getWeekStart(new Date())
  const upcomingWeekStart = getUpcomingWeekStart()

  const [{ data: sessions }, { data: availability }] = await Promise.all([
    supabase
      .from('session_plans')
      .select(
        'id, recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end, status, students(name), protocols(title)'
      )
      .eq('teacher_id', result!.user.id)
      .in('status', ['pending', 'accepted', 'completed'])
      .order('created_at', { ascending: false }),
    supabase
      .from('teacher_availability')
      .select('start_time, end_time')
      .eq('teacher_id', result!.user.id)
      .eq('week_start_date', upcomingWeekStart),
  ])

  const allSessions = sessions ?? []

  // Occurrences — used for ScheduleCalendar and awaiting-notes check
  const weeklyIds = allSessions.filter((s) => s.recurrence_type === 'weekly').map((s) => s.id)
  const { data: occurrenceRows } =
    weeklyIds.length > 0
      ? await supabase
          .from('session_occurrences')
          .select('session_plan_id, week_start_date')
          .in('session_plan_id', weeklyIds)
      : { data: [] }

  const occurrences: CompletedOccurrence[] = (occurrenceRows ?? []).map((o) => ({
    sessionId: o.session_plan_id,
    weekStartDate: o.week_start_date,
  }))

  // Sessions that already have an occurrence this week (note written)
  const notedThisWeek = new Set(
    (occurrenceRows ?? [])
      .filter((o) => o.week_start_date === currentWeekStart)
      .map((o) => o.session_plan_id)
  )

  // Awaiting therapy notes: accepted sessions where no note has been written yet
  const awaitingNotes = allSessions.filter((s) => {
    if (s.status !== 'accepted') return false
    if (s.recurrence_type === 'one_off') return true
    if (s.day_of_week === null || !s.time_of_day_start) return false
    if (notedThisWeek.has(s.id)) return false
    return dateForDayOfWeek(currentWeekStart, s.day_of_week) <= todayStr
  })

  // Today's sessions (pending or accepted, happening today)
  const todaysSessions = allSessions
    .filter((s) => {
      if (s.status === 'completed') return false
      if (s.recurrence_type === 'one_off' && s.start_time) {
        return dateStringInBusinessTz(new Date(s.start_time)) === todayStr
      }
      if (s.recurrence_type === 'weekly') {
        return s.day_of_week === todayDow && s.status === 'accepted'
      }
      return false
    })
    .sort((a, b) => {
      const aTime = a.recurrence_type === 'one_off' ? (a.start_time ?? '') : `1970-01-01T${a.time_of_day_start ?? '00:00'}`
      const bTime = b.recurrence_type === 'one_off' ? (b.start_time ?? '') : `1970-01-01T${b.time_of_day_start ?? '00:00'}`
      return aTime.localeCompare(bTime)
    })

  // Stats
  const pendingCount = allSessions.filter((s) => s.status === 'pending').length
  const confirmedCount = allSessions.filter((s) => s.status === 'accepted').length
  const completedCount = allSessions.filter((s) => s.status === 'completed').length
  const availableHours = (availability ?? []).reduce(
    (sum, a) => sum + hoursBetween(a.start_time, a.end_time),
    0
  )

  // ScheduleCalendar rows
  const sessionRows: TeacherSessionRow[] = allSessions.map((s) => {
    const isOneOff = s.recurrence_type === 'one_off'
    const start = isOneOff ? new Date(s.start_time as string) : null
    return {
      id: s.id,
      recurrenceType: s.recurrence_type,
      date: start ? dateStringInBusinessTz(start) : null,
      dayOfWeek: start ? dayOfWeekInBusinessTz(start) : (s.day_of_week as number),
      startTime: start
        ? formatTimeInBusinessTz(start).slice(0, 5)
        : (s.time_of_day_start as string).slice(0, 5),
      endTime: isOneOff
        ? formatTimeInBusinessTz(new Date(s.end_time as string)).slice(0, 5)
        : (s.time_of_day_end as string).slice(0, 5),
      status: s.status,
      studentName:
        (Array.isArray(s.students) ? s.students[0]?.name : s.students?.name) ?? 'Unknown student',
      protocolName:
        (Array.isArray(s.protocols) ? s.protocols[0]?.title : s.protocols?.title) ??
        'Unknown protocol',
    }
  })

  const firstName = result!.profile.name?.split(' ')[0] ?? 'Teacher'
  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: BUSINESS_TIMEZONE,
  }).format(new Date())

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">{todayLabel}</p>
      </div>

      {/* Action alerts */}
      {(awaitingNotes.length > 0 || pendingCount > 0) && (
        <div className="flex flex-col gap-2">
          {awaitingNotes.length > 0 && (
            <Link
              href="/teacher/therapy-notes"
              className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg leading-none">📝</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {awaitingNotes.length} session{awaitingNotes.length > 1 ? 's' : ''} need
                    {awaitingNotes.length === 1 ? 's' : ''} a therapy note
                  </p>
                  <p className="text-xs text-amber-600">
                    Sessions aren&apos;t complete until the note is written
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold text-amber-700 flex-shrink-0">Write →</span>
            </Link>
          )}
          {pendingCount > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg leading-none">⏳</span>
                <p className="text-sm font-semibold text-blue-800">
                  {pendingCount} session{pendingCount > 1 ? 's' : ''} awaiting your confirmation
                </p>
              </div>
              <span className="text-xs text-blue-500 flex-shrink-0">↓ see schedule</span>
            </div>
          )}
        </div>
      )}

      {/* Today's sessions */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Today · {DAY_NAMES[todayDow]}
        </h2>
        {todaysSessions.length === 0 ? (
          <div className="rounded-xl border border-gray-200 py-6 text-center text-sm text-gray-400">
            No sessions scheduled for today
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todaysSessions.map((s) => {
              const studentName =
                (Array.isArray(s.students) ? s.students[0]?.name : s.students?.name) ?? 'Unknown'
              const protocolName =
                (Array.isArray(s.protocols) ? s.protocols[0]?.title : s.protocols?.title) ??
                'Unknown'
              const timeStr =
                s.recurrence_type === 'one_off' && s.start_time
                  ? formatTimeInBusinessTz(new Date(s.start_time)).slice(0, 5)
                  : s.time_of_day_start?.slice(0, 5) ?? '—'
              const isAccepted = s.status === 'accepted'
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3"
                >
                  <div className="w-12 flex-shrink-0 text-sm font-semibold tabular-nums text-gray-500">
                    {timeStr}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{studentName}</p>
                    <p className="truncate text-xs text-gray-400">{protocolName}</p>
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: isAccepted ? 'rgba(34,197,94,0.1)' : 'rgba(245,144,48,0.1)',
                      color: isAccepted ? '#16a34a' : '#ea580c',
                    }}
                  >
                    {isAccepted ? 'Confirmed' : 'Pending'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: availableHours, label: `Available hrs\n(${formatWeekLabel(upcomingWeekStart)})`, color: '#6B7280' },
          { value: pendingCount, label: 'Pending\nconfirmation', color: '#ea580c' },
          { value: confirmedCount, label: 'Confirmed\nsessions', color: '#16a34a' },
          { value: completedCount, label: 'Completed\nsessions', color: '#3B82F6' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: stat.color }}>
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-gray-500 whitespace-pre-line leading-tight">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Full schedule */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Full schedule
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          Confirm a pending session to accept it. Once the class has happened, write its therapy
          note — that&apos;s what actually marks the session complete.
        </p>
        <ScheduleCalendar sessions={sessionRows} occurrences={occurrences} />
      </section>

    </main>
  )
}
