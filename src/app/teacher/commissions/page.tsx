import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { BackLink } from '@/components/back-link'
import { BUSINESS_TIMEZONE, dateStringInBusinessTz, businessLocalToISOString } from '@/lib/timezone'
import { formatRupiah } from '@/lib/money'
import { getWeekStart, addWeeks, formatWeekLabel, dateForDayOfWeek } from '@/lib/week'

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: BUSINESS_TIMEZONE,
})

interface Breakdown {
  name: string
  count: number
  amount: number
}

/**
 * What this teacher earns per delivered session, by child. A teacher never
 * reads what the school bills: the database function my_commission_rates()
 * returns only the commission (the teacher's own rate for the child if there
 * is one, otherwise the child's default). Until that function is installed
 * (supabase/fix_teacher_commission_only.sql), fall back to reading just the
 * commission columns, so the page keeps working in the meantime.
 */
async function loadMyCommissions(supabase: Awaited<ReturnType<typeof createClient>>, studentIds: string[], teacherId: string) {
  const byStudent = new Map<string, number>()
  if (studentIds.length === 0) return byStudent

  const { data, error } = await supabase.rpc('my_commission_rates')
  if (!error) {
    for (const r of data ?? []) byStudent.set(r.student_id, Number(r.commission_rate))
    return byStudent
  }

  const { data: rows } = await supabase
    .from('billing_rates')
    .select('student_id, teacher_id, commission_rate')
    .in('student_id', studentIds)
    .or(`teacher_id.eq.${teacherId},teacher_id.is.null`)
  const own = new Map<string, number>()
  for (const r of rows ?? []) {
    if (r.teacher_id === teacherId) own.set(r.student_id, Number(r.commission_rate))
    else if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, Number(r.commission_rate))
  }
  for (const [studentId, commission] of own) byStudent.set(studentId, commission)
  return byStudent
}

function addToBreakdown(map: Map<string, Breakdown>, name: string, commission: number) {
  const existing = map.get(name) ?? { name, count: 0, amount: 0 }
  existing.count += 1
  existing.amount += commission
  map.set(name, existing)
}

function BreakdownTable({ title, rows }: { title: string; rows: Breakdown[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-gray-700">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing delivered this week yet.</p>
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
                    <td className="p-2 font-medium">{formatRupiah(r.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default async function TeacherCommissionsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const result = await getUserProfile()
  const supabase = await createClient()
  const { week } = await searchParams
  const weekStartDate = week ? getWeekStart(new Date(`${week}T00:00:00Z`)) : getWeekStart(new Date())
  const teacherId = result!.user.id

  const { data: allSessions } = await supabase
    .from('session_plans')
    .select('id, student_id, recurrence_type, start_time, day_of_week, time_of_day_start, status, students(name), protocols(title)')
    .eq('teacher_id', teacherId)

  const studentIds = Array.from(new Set((allSessions ?? []).map((s) => s.student_id)))
  const commissionByStudent = await loadMyCommissions(supabase, studentIds, teacherId)

  const sessionInfoById = new Map(
    (allSessions ?? []).map((s) => [
      s.id,
      {
        studentId: s.student_id,
        studentName: (Array.isArray(s.students) ? s.students[0]?.name : s.students?.name) ?? 'Unknown student',
        protocolName: (Array.isArray(s.protocols) ? s.protocols[0]?.title : s.protocols?.title) ?? 'Unknown protocol',
        // For a one-off, start_time is the real delivery instant. For a
        // weekly session there's no date of its own — its instant for THIS
        // week's delivery is this occurrence's date (weekStartDate + day of
        // week) combined with its recurring start time.
        whenISO:
          s.recurrence_type === 'one_off' && s.start_time
            ? s.start_time
            : s.day_of_week !== null && s.time_of_day_start
              ? businessLocalToISOString(`${dateForDayOfWeek(weekStartDate, s.day_of_week)}T${s.time_of_day_start.slice(0, 5)}`)
              : null,
      },
    ])
  )

  const sessionIds = (allSessions ?? []).map((s) => s.id)
  const { data: occurrenceRows } =
    sessionIds.length > 0
      ? await supabase
          .from('session_occurrences')
          .select('session_plan_id')
          .in('session_plan_id', sessionIds)
          .eq('week_start_date', weekStartDate)
      : { data: [] }

  const byStudent = new Map<string, Breakdown>()
  const byProtocol = new Map<string, Breakdown>()
  const deliveredSessions: { whenISO: string | null; when: string; studentName: string; protocolName: string; commission: number | null }[] = []
  let totalDelivered = 0
  let unratedDelivered = 0
  let totalCommission = 0

  function deliver(sessionId: string) {
    const info = sessionInfoById.get(sessionId)
    if (!info) return
    const commission = commissionByStudent.get(info.studentId)
    const when = info.whenISO ? dateTimeFormatter.format(new Date(info.whenISO)) : 'Unknown time'
    totalDelivered += 1
    if (commission === undefined) {
      unratedDelivered += 1
      deliveredSessions.push({ whenISO: info.whenISO, when, studentName: info.studentName, protocolName: info.protocolName, commission: null })
      return
    }
    addToBreakdown(byStudent, info.studentName, commission)
    addToBreakdown(byProtocol, info.protocolName, commission)
    totalCommission += commission
    deliveredSessions.push({ whenISO: info.whenISO, when, studentName: info.studentName, protocolName: info.protocolName, commission })
  }

  // One-off: her own status='completed' marking is the delivery record.
  const fridayDate = dateForDayOfWeek(weekStartDate, 5)
  for (const s of allSessions ?? []) {
    if (s.recurrence_type !== 'one_off' || s.status !== 'completed' || !s.start_time) continue
    const d = dateStringInBusinessTz(new Date(s.start_time))
    if (d < weekStartDate || d > fridayDate) continue
    deliver(s.id)
  }

  // Weekly: this exact week's occurrence is one delivery — occurrenceRows is
  // already scoped to weekStartDate above.
  for (const o of occurrenceRows ?? []) {
    deliver(o.session_plan_id)
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <BackLink href="/teacher" label="Your sessions" />
        <h1 className="mb-1 text-xl font-semibold">Commissions</h1>
        <p className="text-sm text-gray-500">
          Your commission per delivered session, set by the owner per child — a one-off session once you mark it
          Complete, a weekly session once you mark that week&apos;s occurrence Complete.
        </p>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <Link href={`/teacher/commissions?week=${addWeeks(weekStartDate, -1)}`} className="text-blue-600 hover:underline">
          ← Prev week
        </Link>
        <span className="font-medium text-gray-700">Week of {formatWeekLabel(weekStartDate)}</span>
        <Link href={`/teacher/commissions?week=${addWeeks(weekStartDate, 1)}`} className="text-blue-600 hover:underline">
          Next week →
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 text-center">
        <p className="text-3xl font-bold text-green-700">{formatRupiah(totalCommission)}</p>
        <p className="text-sm text-gray-500">
          {totalDelivered} session{totalDelivered === 1 ? '' : 's'} delivered — week of {formatWeekLabel(weekStartDate)}
        </p>
        {unratedDelivered > 0 && (
          <p className="mt-1 text-xs text-amber-600">
            {unratedDelivered} of those {unratedDelivered === 1 ? "isn't" : "aren't"} counted above — no commission rate is set yet
            for that child. Ask the owner to set one on the Billing page.
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Delivered sessions</h2>
        {deliveredSessions.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing delivered this week yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left">
                  <th className="p-2 font-medium text-gray-700">When</th>
                  <th className="p-2 font-medium text-gray-700">Student</th>
                  <th className="p-2 font-medium text-gray-700">Protocol</th>
                  <th className="p-2 font-medium text-gray-700">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deliveredSessions
                  .slice()
                  .sort((a, b) => (a.whenISO ?? '').localeCompare(b.whenISO ?? ''))
                  .map((s, i) => (
                    <tr key={i}>
                      <td className="p-2 whitespace-nowrap">{s.when}</td>
                      <td className="p-2">{s.studentName}</td>
                      <td className="p-2">{s.protocolName}</td>
                      <td className={`p-2 font-medium ${s.commission === null ? 'text-amber-600' : ''}`}>
                        {s.commission === null ? 'no rate set' : formatRupiah(s.commission)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <BreakdownTable title="By student" rows={Array.from(byStudent.values())} />
      <BreakdownTable title="By protocol" rows={Array.from(byProtocol.values())} />
    </main>
  )
}
