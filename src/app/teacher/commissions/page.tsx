import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { BackLink } from '@/components/back-link'
import { dateStringInBusinessTz } from '@/lib/timezone'

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

interface Breakdown {
  name: string
  count: number
  amount: number
}

function addToBreakdown(map: Map<string, Breakdown>, name: string, commissionPerSession: number) {
  const existing = map.get(name) ?? { name, count: 0, amount: 0 }
  existing.count += 1
  existing.amount += commissionPerSession
  map.set(name, existing)
}

function BreakdownTable({ title, rows }: { title: string; rows: Breakdown[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-gray-700">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing delivered this month yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="p-2 font-medium text-gray-700">{title === 'By student' ? 'Student' : 'Protocol'}</th>
                <th className="p-2 font-medium text-gray-700">Sessions delivered</th>
                <th className="p-2 font-medium text-gray-700">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows
                .sort((a, b) => b.amount - a.amount)
                .map((r) => (
                  <tr key={r.name}>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{r.count}</td>
                    <td className="p-2 font-medium">{currencyFormatter.format(r.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default async function TeacherCommissionsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const result = await getUserProfile()
  const supabase = await createClient()
  const { month } = await searchParams
  const monthPrefix = month || dateStringInBusinessTz(new Date()).slice(0, 7)

  const [{ data: profile }, { data: allSessions }] = await Promise.all([
    supabase.from('profiles').select('commission_per_session').eq('id', result!.user.id).single(),
    supabase
      .from('session_plans')
      .select('id, recurrence_type, start_time, status, students(name), protocols(title)')
      .eq('teacher_id', result!.user.id),
  ])

  const commissionPerSession = profile?.commission_per_session ?? null

  const sessionInfoById = new Map(
    (allSessions ?? []).map((s) => [
      s.id,
      {
        studentName: (Array.isArray(s.students) ? s.students[0]?.name : s.students?.name) ?? 'Unknown student',
        protocolName: (Array.isArray(s.protocols) ? s.protocols[0]?.title : s.protocols?.title) ?? 'Unknown protocol',
      },
    ])
  )

  const sessionIds = (allSessions ?? []).map((s) => s.id)
  const { data: occurrenceRows } =
    sessionIds.length > 0
      ? await supabase.from('session_occurrences').select('session_plan_id, week_start_date').in('session_plan_id', sessionIds)
      : { data: [] }

  const byStudent = new Map<string, Breakdown>()
  const byProtocol = new Map<string, Breakdown>()
  let totalDelivered = 0

  const rate = commissionPerSession ?? 0

  // One-off: her own status='completed' marking is the delivery record.
  for (const s of allSessions ?? []) {
    if (s.recurrence_type !== 'one_off' || s.status !== 'completed' || !s.start_time) continue
    if (!dateStringInBusinessTz(new Date(s.start_time)).startsWith(monthPrefix)) continue
    const info = sessionInfoById.get(s.id)
    if (!info) continue
    addToBreakdown(byStudent, info.studentName, rate)
    addToBreakdown(byProtocol, info.protocolName, rate)
    totalDelivered += 1
  }

  // Weekly: each self-declared week's occurrence is one delivery, attributed
  // by the month its own Monday falls in — same convention used to label a
  // week everywhere else in this app.
  for (const o of occurrenceRows ?? []) {
    if (!o.week_start_date.startsWith(monthPrefix)) continue
    const info = sessionInfoById.get(o.session_plan_id)
    if (!info) continue
    addToBreakdown(byStudent, info.studentName, rate)
    addToBreakdown(byProtocol, info.protocolName, rate)
    totalDelivered += 1
  }

  const totalCommission = totalDelivered * rate

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <BackLink href="/teacher" label="Your sessions" />
        <h1 className="mb-1 text-xl font-semibold">Commissions</h1>
        <p className="text-sm text-gray-500">
          {commissionPerSession !== null
            ? `${currencyFormatter.format(commissionPerSession)} per delivered session — a one-off session once you mark it Complete, a weekly session once you mark that week's occurrence Complete.`
            : 'Your commission rate has not been set yet — ask the owner to set it before this can show a real total.'}
        </p>
      </div>

      <form action="/teacher/commissions" method="GET" className="flex items-center gap-2">
        <input type="month" name="month" defaultValue={monthPrefix} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          View month
        </button>
      </form>

      <div className="rounded-lg border border-gray-200 p-4 text-center">
        <p className="text-3xl font-bold text-green-700">{currencyFormatter.format(totalCommission)}</p>
        <p className="text-sm text-gray-500">
          {totalDelivered} session{totalDelivered === 1 ? '' : 's'} delivered — {monthFormatter.format(new Date(`${monthPrefix}-01T00:00:00Z`))}
        </p>
      </div>

      <BreakdownTable title="By student" rows={Array.from(byStudent.values())} />
      <BreakdownTable title="By protocol" rows={Array.from(byProtocol.values())} />
    </main>
  )
}
