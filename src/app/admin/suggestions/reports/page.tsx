import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { dateStringInBusinessTz } from '@/lib/timezone'
import { MissingProtocols } from './missing-protocols'
import { SuggestionsNav } from '../suggestions-nav'

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

interface CoverageRow {
  id: string
  name: string
  total: number
  doneCount: number
  coveragePercent: number
  missing: { protocolId: string; title: string; prioritized: boolean; alreadyBooked: boolean }[]
}

function coverageColor(percent: number) {
  if (percent >= 70) return 'text-green-600'
  if (percent >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

function CoverageTable({ title, rows }: { title: string; rows: CoverageRow[] }) {
  return (
    <section className="mb-8">
      <h3 className="mb-2 text-base font-semibold text-gray-800">
        {title} ({rows.length})
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">None.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="p-3 font-medium text-gray-700">Student</th>
                <th className="p-3 font-medium text-gray-700">Monthly coverage</th>
                <th className="p-3 font-medium text-gray-700">Done this month</th>
                <th className="p-3 font-medium text-gray-700">Missing protocols</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-3">{r.name}</td>
                  <td className={`p-3 text-xl font-bold ${coverageColor(r.coveragePercent)}`}>{r.coveragePercent}%</td>
                  <td className={`p-3 font-medium ${r.missing.length === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {r.doneCount}/{r.total}
                  </td>
                  <td className="p-3">
                    {r.missing.length === 0 ? (
                      <span className="text-green-600">All done</span>
                    ) : (
                      <MissingProtocols studentId={r.id} missing={r.missing} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams
  const supabase = await createClient()

  const monthPrefix = month || dateStringInBusinessTz(new Date()).slice(0, 7)

  const [{ data: students }, { data: allNeeds }, { data: monthSessionRows }, { data: prioritizedRows }] = await Promise.all([
    supabase.from('students').select('id, name, status').order('name'),
    supabase.from('student_protocols').select('student_id, protocol_id, protocols(title)'),
    supabase
      .from('session_plans')
      .select('student_id, protocol_id, recurrence_type, start_time, status')
      .in('status', ['pending', 'accepted', 'completed']),
    supabase.from('prioritized_needs').select('student_id, protocol_id'),
  ])
  const prioritizedSet = new Set((prioritizedRows ?? []).map((p) => `${p.student_id}:${p.protocol_id}`))

  // Grouped by (student, protocol) — matches how the rest of the app counts
  // a protocol need (a Reflex Repatterning need with several sub-protocols
  // is still one bookable session, so it's one need here too).
  const neededProtocolNamesByStudent = new Map<string, Map<string, string>>()
  for (const n of allNeeds ?? []) {
    const protocolTitle = (Array.isArray(n.protocols) ? n.protocols[0]?.title : n.protocols?.title) ?? 'Unknown protocol'
    const names = neededProtocolNamesByStudent.get(n.student_id) ?? new Map<string, string>()
    names.set(n.protocol_id, protocolTitle)
    neededProtocolNamesByStudent.set(n.student_id, names)
  }

  // A protocol is "done this month" if it's actually been DELIVERED, not
  // merely booked — a weekly-recurring session has no single occurrence to
  // mark complete, so it still just needs to be active (not cancelled) and
  // trivially covers every month it recurs through; a one-off session must
  // be teacher-marked 'completed' to count (booking-dedup in getUnmetNeeds
  // stays looser — pending/accepted still blocks re-scheduling there, so a
  // not-yet-completed session doesn't get double-booked, it just won't show
  // as "done" here until she completes it).
  const monthlySatisfiedByStudent = new Map<string, Set<string>>()
  for (const row of monthSessionRows ?? []) {
    const delivered = row.recurrence_type === 'weekly' ? true : row.status === 'completed'
    if (!delivered) continue
    const inMonth = row.recurrence_type === 'weekly' || (row.start_time && dateStringInBusinessTz(new Date(row.start_time)).startsWith(monthPrefix))
    if (!inMonth) continue
    const set = monthlySatisfiedByStudent.get(row.student_id) ?? new Set<string>()
    set.add(row.protocol_id)
    monthlySatisfiedByStudent.set(row.student_id, set)
  }

  // A "missing" (not-yet-delivered) protocol can still already have a
  // pending/accepted one-off session booked for it this month — Prioritize
  // would be a no-op there, since getUnmetNeeds already excludes anything
  // with an active session this month from Generate Schedule's candidate
  // pool regardless of the prioritized flag. Only a protocol with no session
  // at all this month is genuinely actionable via Prioritize.
  const bookedThisMonthByStudent = new Map<string, Set<string>>()
  for (const row of monthSessionRows ?? []) {
    if (row.recurrence_type !== 'one_off' || row.status === 'completed') continue
    const inMonth = row.start_time && dateStringInBusinessTz(new Date(row.start_time)).startsWith(monthPrefix)
    if (!inMonth) continue
    const set = bookedThisMonthByStudent.get(row.student_id) ?? new Set<string>()
    set.add(row.protocol_id)
    bookedThisMonthByStudent.set(row.student_id, set)
  }

  const monthlyRows = (students ?? [])
    .map((s) => {
      // Inactive students are never allocated, so they'd only ever show as
      // 0% with dead "Prioritize" buttons — excluded entirely.
      if (s.status === 'inactive') return null
      const neededNames = neededProtocolNamesByStudent.get(s.id)
      if (!neededNames || neededNames.size === 0) return null
      const satisfied = monthlySatisfiedByStudent.get(s.id) ?? new Set<string>()
      const missing = Array.from(neededNames.entries())
        .filter(([protocolId]) => !satisfied.has(protocolId))
        .map(([protocolId, title]) => ({
          protocolId,
          title,
          prioritized: prioritizedSet.has(`${s.id}:${protocolId}`),
          alreadyBooked: bookedThisMonthByStudent.get(s.id)?.has(protocolId) ?? false,
        }))
        .sort((a, b) => a.title.localeCompare(b.title))
      const doneCount = neededNames.size - missing.length
      const coveragePercent = Math.min(100, Math.round((doneCount / neededNames.size) * 100))
      return { id: s.id, name: s.name, status: s.status, total: neededNames.size, doneCount, coveragePercent, missing }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  const studentRows = monthlyRows.filter((r) => r.status === 'student')
  const nonStudentRows = monthlyRows.filter((r) => r.status !== 'student')

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Suggestions</h1>
      <SuggestionsNav active="/admin/suggestions/reports" />

      <form action="/admin/suggestions/reports" method="GET" className="mb-4 flex items-center gap-2">
        <input
          type="month"
          name="month"
          defaultValue={monthPrefix}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          View report
        </button>
      </form>

      <h2 className="mb-1 text-lg font-semibold">Monthly protocol coverage — {monthFormatter.format(new Date(`${monthPrefix}-01T00:00:00Z`))}</h2>
      <p className="mb-4 text-sm text-gray-500">
        Whether each student has had a protocol actually delivered this calendar month, not just booked — a one-off
        session only counts once the teacher marks it Complete; a weekly-recurring session counts for every month it
        recurs through. Prioritize a missing protocol to jump it to the front of Generate Schedule&apos;s queue for
        its next attempt.
      </p>

      {monthlyRows.length === 0 ? (
        <p className="text-sm text-gray-500">No students with protocol needs.</p>
      ) : (
        <>
          <CoverageTable title="Student" rows={studentRows} />
          <CoverageTable title="Non-student" rows={nonStudentRows} />
        </>
      )}
    </main>
  )
}
