import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { LogoutButton } from '@/components/logout-button'
import { dateStringInBusinessTz, dayOfWeekInBusinessTz, formatTimeInBusinessTz } from '@/lib/timezone'
import { getUpcomingWeekStart, formatWeekLabel } from '@/lib/week'
import { ScheduleCalendar, type TeacherSessionRow, type CompletedOccurrence } from './schedule-calendar'

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

export default async function TeacherDashboard() {
  const result = await getUserProfile()
  const supabase = await createClient()
  const weekStart = getUpcomingWeekStart()

  const [{ data: sessions }, { count: confirmedCount }, { count: completedCount }, { data: availability }] = await Promise.all([
    supabase
      .from('session_plans')
      .select(
        'id, recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end, status, students(name), protocols(title)'
      )
      .eq('teacher_id', result!.user.id)
      .in('status', ['pending', 'accepted', 'completed'])
      .order('created_at', { ascending: false }),
    supabase
      .from('session_plans')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', result!.user.id)
      .in('status', ['accepted', 'completed']),
    supabase
      .from('session_plans')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', result!.user.id)
      .eq('status', 'completed'),
    supabase
      .from('teacher_availability')
      .select('start_time, end_time')
      .eq('teacher_id', result!.user.id)
      .eq('week_start_date', weekStart),
  ])

  const availableHours = (availability ?? []).reduce((sum, a) => sum + hoursBetween(a.start_time, a.end_time), 0)

  const weeklySessionIds = (sessions ?? []).filter((s) => s.recurrence_type === 'weekly').map((s) => s.id)
  const { data: occurrenceRows } =
    weeklySessionIds.length > 0
      ? await supabase.from('session_occurrences').select('session_plan_id, week_start_date').in('session_plan_id', weeklySessionIds)
      : { data: [] }
  const occurrences: CompletedOccurrence[] = (occurrenceRows ?? []).map((o) => ({
    sessionId: o.session_plan_id,
    weekStartDate: o.week_start_date,
  }))

  const sessionRows: TeacherSessionRow[] = (sessions ?? []).map((s) => {
    const isOneOff = s.recurrence_type === 'one_off'
    const start = isOneOff ? new Date(s.start_time as string) : null
    return {
      id: s.id,
      recurrenceType: s.recurrence_type,
      date: start ? dateStringInBusinessTz(start) : null,
      dayOfWeek: start ? dayOfWeekInBusinessTz(start) : (s.day_of_week as number),
      startTime: start ? formatTimeInBusinessTz(start).slice(0, 5) : (s.time_of_day_start as string).slice(0, 5),
      endTime: isOneOff
        ? formatTimeInBusinessTz(new Date(s.end_time as string)).slice(0, 5)
        : (s.time_of_day_end as string).slice(0, 5),
      status: s.status,
      studentName: (Array.isArray(s.students) ? s.students[0]?.name : s.students?.name) ?? 'Unknown student',
      protocolName: (Array.isArray(s.protocols) ? s.protocols[0]?.title : s.protocols?.title) ?? 'Unknown protocol',
    }
  })

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your sessions</h1>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="font-medium text-gray-900">{result!.profile.name}</p>
            <p className="text-gray-500">{result!.user.email}</p>
          </div>
          <Link href="/teacher/availability" className="text-sm text-blue-600 hover:underline">
            Manage availability
          </Link>
          <Link href="/teacher/therapy-notes" className="text-sm text-blue-600 hover:underline">
            Therapy notes
          </Link>
          <Link href="/teacher/commissions" className="text-sm text-blue-600 hover:underline">
            Commissions
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-semibold">{availableHours}</p>
          <p className="text-sm text-gray-500">Hours available ({formatWeekLabel(weekStart)})</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-semibold">{confirmedCount ?? 0}</p>
          <p className="text-sm text-gray-500">Confirmed sessions</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-semibold">{completedCount ?? 0}</p>
          <p className="text-sm text-gray-500">Completed sessions</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-gray-500">
          Confirm a pending session to accept it. Once the class has happened, write its therapy note — that&apos;s
          what actually marks the session complete and delivers her protocol for the month.
        </p>
        <ScheduleCalendar sessions={sessionRows} occurrences={occurrences} />
      </div>
    </main>
  )
}
