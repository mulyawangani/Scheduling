/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireAdminOrOwner } from '@/lib/auth/require-admin-or-owner'
import { BackLink } from '@/components/back-link'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  await requireAdminOrOwner()
  const { month: monthParam } = await searchParams

  const today = new Date()
  const [year, mon] = monthParam
    ? monthParam.split('-').map(Number)
    : [today.getFullYear(), today.getMonth() + 1]
  const currentMonthStr = `${year}-${String(mon).padStart(2, '0')}`
  const monthStart = `${currentMonthStr}-01`

  const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`
  const monthLabel = new Date(monthStart + 'T12:00:00').toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  const supabase = await createClient()
  const db = supabase as any

  // All enrollments in a ±1 year window to show future months per student
  const { data: enrollments } = await db
    .from('enrollments')
    .select(`
      student_id,
      month,
      status,
      students!enrollments_student_id_fkey(id, name, classrooms(name))
    `)
    .gte('month', `${year - 1}-01-01`)
    .lte('month', `${year + 1}-12-01`)
    .eq('status', 'active')

  const allMonthsByStudent: Record<string, string[]> = {}
  for (const e of enrollments ?? []) {
    if (!allMonthsByStudent[e.student_id]) allMonthsByStudent[e.student_id] = []
    allMonthsByStudent[e.student_id].push(e.month)
  }

  const thisMonth = (enrollments ?? []).filter((e: any) => e.month === monthStart)
  const thisMonthStudentIds = thisMonth.map((e: any) => e.student_id)

  // Protocol count per student = number of distinct therapy sessions they need weekly
  const { data: protocolRows } = thisMonthStudentIds.length > 0
    ? await supabase
        .from('student_protocols')
        .select('student_id, protocol_id')
        .in('student_id', thisMonthStudentIds)
    : { data: [] }

  const protocolCountByStudent: Record<string, number> = {}
  for (const row of protocolRows ?? []) {
    const seen = protocolCountByStudent[row.student_id] ?? 0
    protocolCountByStudent[row.student_id] = seen + 1
  }

  const students = thisMonth.map((e: any) => {
    const s = Array.isArray(e.students) ? e.students[0] : e.students
    const classroom = s?.classrooms
      ? (Array.isArray(s.classrooms) ? s.classrooms[0]?.name : s.classrooms?.name)
      : null
    return {
      id: e.student_id,
      name: s?.name ?? 'Unknown',
      classroom,
      months: (allMonthsByStudent[e.student_id] ?? []).sort(),
      sessionCount: protocolCountByStudent[e.student_id] ?? 0,
    }
  }).sort((a: any, b: any) => a.name.localeCompare(b.name))

  // Count how many students are enrolled in future months (for summary)
  const nextMonthCount = (enrollments ?? []).filter((e: any) => e.month === `${nextMonth}-01` || e.month === `${nextMonth.split('-')[0]}-${nextMonth.split('-')[1]}-01`).length

  return (
    <main className="mx-auto max-w-4xl p-6 flex flex-col gap-6">
      <div>
        <BackLink href="/admin" label="Dashboard" />
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-xl font-semibold">Enrollment</h1>
          <Link
            href={`/admin/attendance?month=${currentMonthStr}`}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            View Attendance →
          </Link>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/enrollment?month=${prevMonth}`} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors">‹</Link>
        <span className="text-base font-semibold text-gray-800 min-w-[160px] text-center">{monthLabel}</span>
        <Link href={`/admin/enrollment?month=${nextMonth}`} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors">›</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{students.length}</div>
          <div className="text-xs font-medium text-gray-500 mt-1">Enrolled this month</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">
            {(enrollments ?? []).filter((e: any) => {
              const m = e.month?.slice(0, 7)
              return m === nextMonth
            }).length}
          </div>
          <div className="text-xs font-medium text-gray-500 mt-1">Pre-enrolled next month</div>
        </div>
      </div>

      {/* Roster */}
      {students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          No students enrolled for {monthLabel}.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {students.length} students
          </div>
          <ul className="divide-y divide-gray-50">
            {students.map((s: any) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">{s.name}</div>
                  {s.classroom && <div className="text-xs text-gray-400">{s.classroom}</div>}
                </div>
                <div className="flex-shrink-0 w-20 text-center">
                  {s.sessionCount > 0 ? (
                    <div>
                      <span className="text-sm font-semibold text-gray-800">{s.sessionCount}</span>
                      <span className="text-[10px] text-gray-400 ml-0.5">sessions/wk</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {s.months.map((m: string) => {
                    const label = new Date(m + 'T12:00:00').toLocaleString('default', { month: 'short' })
                    const isCurrent = m.startsWith(currentMonthStr)
                    return (
                      <span
                        key={m}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ background: isCurrent ? '#F59030' : '#F3F4F6', color: isCurrent ? 'white' : '#9CA3AF' }}
                      >
                        {label}
                      </span>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}
