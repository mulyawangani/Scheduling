import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { getUnmetNeeds } from '@/lib/matching/unmet-needs'
import { generateSchedule } from '@/lib/matching/generate-schedule'
import { getWeekStart, getUpcomingWeekStart, formatWeekLabel } from '@/lib/week'

function percentColor(percent: number | null) {
  if (percent === null) return 'text-gray-400'
  if (percent >= 70) return 'text-green-600'
  if (percent >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [{ data: allNeeds }, unmet, { data: allHistoryRows }] = await Promise.all([
    supabase.from('student_protocols').select('student_id, protocol_id, students(status)'),
    getUnmetNeeds(supabase, getUpcomingWeekStart()),
    // Every status, newest first, to check whether each unmet need's most
    // recent session outcome was a cancellation or a teacher decline — same
    // "reopened" definition the Recommendation page uses.
    supabase.from('session_plans').select('student_id, protocol_id, status').order('created_at', { ascending: false }),
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

  // Grouped by (student, protocol) — a protocol with several needed
  // sub-protocols (e.g. Reflex Repatterning) is one bookable session, so it
  // counts as one need here too, matching how Scheduling groups them.
  // Inactive students are excluded — they're never allocated, so counting
  // their needs here would understate fulfillment for no actionable reason.
  const total = new Set(
    (allNeeds ?? [])
      .filter((n) => (Array.isArray(n.students) ? n.students[0]?.status : n.students?.status) !== 'inactive')
      .map((n) => `${n.student_id}:${n.protocol_id}`)
  ).size
  const scheduled = Math.max(0, total - unmet.length)
  const percent = total > 0 ? Math.round((scheduled / total) * 100) : null

  // Weeks worth breaking out individually: every week with a committed
  // one-off session, plus every week a schedule was generated/saved as a
  // version — no version is required, this is computed live from
  // generateSchedule() the same way the Simulations page already does.
  // Weekly-recurring sessions repeat indefinitely rather than belonging to
  // one week, so they aren't attributed to a single row here.
  const [{ data: oneOffDates }, { data: versionWeeks }] = await Promise.all([
    supabase
      .from('session_plans')
      .select('start_time')
      .eq('recurrence_type', 'one_off')
      .in('status', ['pending', 'accepted', 'completed']),
    supabase.from('schedule_versions').select('week_start_date'),
  ])

  const weekSet = new Set<string>()
  for (const row of oneOffDates ?? []) {
    if (row.start_time) weekSet.add(getWeekStart(new Date(row.start_time)))
  }
  for (const row of versionWeeks ?? []) {
    weekSet.add(row.week_start_date)
  }
  const weeks = Array.from(weekSet).sort()

  const weekBreakdown = await Promise.all(
    weeks.map(async (weekStartDate) => {
      const weekSchedule = await generateSchedule(supabase, weekStartDate)
      const weekTotal = weekSchedule.existing.length + weekSchedule.unscheduled.length
      const weekPercent = weekTotal > 0 ? Math.round((weekSchedule.existing.length / weekTotal) * 100) : null
      return { weekStartDate, scheduled: weekSchedule.existing.length, total: weekTotal, percent: weekPercent }
    })
  )

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Owner dashboard</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/admin/suggestions" className="text-blue-600 hover:underline">
            Scheduling
          </Link>
          <Link href="/admin/teachers" className="text-blue-600 hover:underline">
            Teachers
          </Link>
          <Link href="/admin/protocols" className="text-blue-600 hover:underline">
            Protocols
          </Link>
          <Link href="/admin/children" className="text-blue-600 hover:underline">
            Children
          </Link>
          <Link href="/admin/parents" className="text-blue-600 hover:underline">
            Parents
          </Link>
          <Link href="/admin/calendar" className="text-blue-600 hover:underline">
            Calendar
          </Link>
          <Link href="/admin/therapy-notes" className="text-blue-600 hover:underline">
            Therapy notes
          </Link>
          <Link href="/admin/audit-log" className="text-blue-600 hover:underline">
            Audit log
          </Link>
          <LogoutButton />
        </div>
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

      <div className="rounded-lg border border-gray-200 p-6 text-center">
        <h2 className="mb-2 text-sm font-medium text-gray-700">Active schedule</h2>
        <p className={`text-5xl font-semibold ${percentColor(percent)}`}>{percent === null ? '—' : `${percent}%`}</p>
        <p className="mt-2 text-sm text-gray-500">
          {total === 0 ? 'No protocol needs yet.' : `${scheduled} of ${total} protocol needs currently scheduled`}
        </p>
      </div>

      {weekBreakdown.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-medium text-gray-700">Active schedule by week</h2>
          <ul className="flex flex-col divide-y divide-gray-200">
            {weekBreakdown.map((w) => (
              <li key={w.weekStartDate} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/admin/suggestions?week=${w.weekStartDate}`} className="text-blue-600 hover:underline">
                  Week of {formatWeekLabel(w.weekStartDate)}
                </Link>
                <span className={`font-semibold ${percentColor(w.percent)}`}>
                  {w.percent === null ? '—' : `${w.percent}%`}{' '}
                  <span className="font-normal text-gray-400">
                    ({w.scheduled}/{w.total})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}
