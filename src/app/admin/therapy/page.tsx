import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/require-capability'
import { getUnmetNeeds } from '@/lib/matching/unmet-needs'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { generateSchedule } from '@/lib/matching/generate-schedule'
import { buildNoSessionReport } from '@/lib/matching/no-session-report'
import { countSessionsInWeek, weeklyTarget } from '@/lib/matching/weekly-coverage'
import { getWeekStart, getUpcomingWeekStart, formatWeekLabel } from '@/lib/week'
import { formatTarget, percentColor } from '@/lib/dashboard/format'
import { BackLink } from '@/components/back-link'
import { NoSessionPanel } from '../no-session-panel'
import { HomeShortcuts } from '../home-shortcuts'

export const dynamic = 'force-dynamic'

/**
 * The therapy side at a glance: how much of the schedule is booked, who has nothing booked next
 * week and why, and week by week coverage. This used to be the Owner's home page.
 */
export default async function TherapyOverviewPage() {
  const { role } = await requireCapability('sched.generate')
  const supabase = await createClient()

  const [{ data: allNeeds }, unmet, { data: allHistoryRows }] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase.from('student_protocols').select('student_id, protocol_id, students(therapy_on)').order('id').range(from, to)
    ),
    getUnmetNeeds(supabase, getUpcomingWeekStart()),
    // Full history (newest first, id breaks ties so pages are stable) — paged
    // because a plain query silently stops at 1,000 rows.
    fetchAllRows((from, to) =>
      supabase.from('session_plans').select('student_id, protocol_id, status').order('created_at', { ascending: false }).order('id').range(from, to)
    ),
  ])

  const mostRecentStatusByNeed = new Map<string, string>()
  for (const row of allHistoryRows ?? []) {
    const key = `${row.student_id}:${row.protocol_id}`
    if (!mostRecentStatusByNeed.has(key)) mostRecentStatusByNeed.set(key, row.status)
  }
  const reopenedCount = unmet.filter((n) => {
    const status = mostRecentStatusByNeed.get(`${n.studentId}:${n.protocolId}`)
    return status === 'cancelled' || status === 'declined'
  }).length

  const total = new Set(
    (allNeeds ?? [])
      .filter((n) => (Array.isArray(n.students) ? n.students[0]?.therapy_on : n.students?.therapy_on) === true)
      .map((n) => `${n.student_id}:${n.protocol_id}`)
  ).size
  const scheduled = Math.max(0, total - unmet.length)
  const percent = total > 0 ? Math.round((scheduled / total) * 100) : null

  const upcomingWeek = getUpcomingWeekStart()
  const [{ data: bookedSessions }, { data: versionWeeks }, upcomingSchedule, { data: studentRows }, { data: availabilityRows }] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from('session_plans')
        .select('recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end')
        .in('status', ['pending', 'accepted', 'completed'])
        .order('id')
        .range(from, to)
    ),
    supabase.from('schedule_versions').select('week_start_date'),
    generateSchedule(supabase, upcomingWeek),
    fetchAllRows((from, to) =>
      supabase.from('students').select('id, name, therapy_on, profiles!students_parent_id_fkey(name)').order('id').range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase.from('student_availability').select('student_id, day_of_week, specific_date').order('id').range(from, to)
    ),
  ])

  const availabilityByStudent = new Map<string, { dayOfWeek: number | null; specificDate: string | null }[]>()
  for (const a of availabilityRows ?? []) {
    const list = availabilityByStudent.get(a.student_id) ?? []
    list.push({ dayOfWeek: a.day_of_week, specificDate: a.specific_date })
    availabilityByStudent.set(a.student_id, list)
  }

  // Every active child with nothing booked next week, and why — so nobody can
  // silently go a whole week without a session (or be invisible to scheduling).
  const noSessionReport = buildNoSessionReport({
    students: (studentRows ?? []).map((s) => {
      const parent = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
      return { id: s.id, name: s.name, therapyOn: s.therapy_on, parentName: parent?.name ?? null }
    }),
    studentIdsWithNeeds: new Set((allNeeds ?? []).map((n) => n.student_id)),
    availabilityByStudent,
    schedule: upcomingSchedule,
  })

  const weekSet = new Set<string>()
  for (const row of bookedSessions ?? []) {
    if (row.recurrence_type === 'one_off' && row.start_time) weekSet.add(getWeekStart(new Date(row.start_time)))
  }
  for (const row of versionWeeks ?? []) {
    weekSet.add(row.week_start_date)
  }
  const weeks = Array.from(weekSet).sort()

  // Each week is judged against its share of the monthly target: one session for every child and
  // protocol need (the same count as the Active schedule card), split evenly over the weeks of the month.
  const weekBreakdown = weeks.map((weekStartDate) => {
    const booked = countSessionsInWeek(bookedSessions ?? [], weekStartDate)
    const target = weeklyTarget(total, weekStartDate)
    return { weekStartDate, booked, target, percent: target > 0 ? Math.round((booked / target) * 100) : null }
  })

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <BackLink href="/admin" label="Dashboard" />
        <h1 className="text-xl font-semibold">Therapy overview</h1>
      </div>

      {reopenedCount > 0 && (
        <Link
          href="/admin/suggestions/recommendation"
          className="block rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          ⚠ {reopenedCount} session{reopenedCount === 1 ? '' : 's'} need{reopenedCount === 1 ? 's' : ''} reassignment — cancelled or declined,
          reopened on Recommendation
        </Link>
      )}

      <NoSessionPanel report={noSessionReport} weekStartDate={upcomingWeek} />

      <div className="rounded-lg border border-gray-200 p-6 text-center">
        <h2 className="mb-2 text-sm font-medium text-gray-700">Active schedule</h2>
        <p className={`text-5xl font-semibold ${percentColor(percent)}`}>{percent === null ? '—' : `${percent}%`}</p>
        <p className="mt-2 text-sm text-gray-500">
          {total === 0 ? 'No protocol needs yet.' : `${scheduled} of ${total} protocol needs currently scheduled`}
        </p>
      </div>

      {weekBreakdown.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-1 text-sm font-medium text-gray-700">Active schedule by week</h2>
          <p className="mb-3 text-xs text-gray-500">
            Sessions booked that week against that week&apos;s share of the monthly target: one session for each of the {total} child and
            protocol needs, split evenly over the weeks of the month.
          </p>
          <ul className="flex flex-col divide-y divide-gray-200">
            {weekBreakdown.map((w) => (
              <li key={w.weekStartDate} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/admin/suggestions?week=${w.weekStartDate}`} className="text-blue-600 hover:underline">
                  Week of {formatWeekLabel(w.weekStartDate)}
                </Link>
                <span className={`font-semibold ${percentColor(w.percent)}`}>
                  {w.percent === null ? '—' : `${w.percent}%`}{' '}
                  <span className="font-normal text-gray-400">
                    ({w.booked} / {formatTarget(w.target)})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <HomeShortcuts role={role} groups={['therapy']} title="Therapy pages" hide={['/admin/therapy']} />
    </main>
  )
}
