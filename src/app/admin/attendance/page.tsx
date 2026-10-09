/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/require-capability'
import { canChange } from '@/lib/auth/permissions'
import { BackLink } from '@/components/back-link'
import Link from 'next/link'
import { AttendanceGrid } from '../enrollment/attendance-grid'

export const dynamic = 'force-dynamic'

function getDaysInMonth(year: number, month: number) {
  const days = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = new Date(date + 'T12:00:00').getDay()
    days.push({ date, label: d, dow, isWeekend: dow === 0 || dow === 6 })
  }
  return days
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { role } = await requireCapability('ops.attendance.view')
  const { month: monthParam } = await searchParams

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const [year, mon] = monthParam
    ? monthParam.split('-').map(Number)
    : [today.getFullYear(), today.getMonth() + 1]
  const currentMonthStr = `${year}-${String(mon).padStart(2, '0')}`
  const monthStart = `${currentMonthStr}-01`

  const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`
  const monthLabel = new Date(monthStart + 'T12:00:00').toLocaleString('en-GB', { month: 'long', year: 'numeric' })
  const daysInMonth = getDaysInMonth(year, mon)

  const supabase = await createClient()
  const db = supabase as any

  // Enrollments in a ±1 year window — active students only
  const { data: enrollments } = await db
    .from('enrollments')
    .select(`
      student_id,
      month,
      students!enrollments_student_id_fkey(id, name, status, classrooms(name))
    `)
    .gte('month', `${year - 1}-01-01`)
    .lte('month', `${year + 1}-12-01`)
    .eq('status', 'active')

  // Only enrolled students with status='student' (same rule as enrollment page)
  const activeEnrollments = (enrollments ?? []).filter((e: any) => {
    const s = Array.isArray(e.students) ? e.students[0] : e.students
    return s?.status === 'student'
  })

  const allMonthsByStudent: Record<string, string[]> = {}
  for (const e of activeEnrollments) {
    if (!allMonthsByStudent[e.student_id]) allMonthsByStudent[e.student_id] = []
    allMonthsByStudent[e.student_id].push(e.month)
  }

  const thisMonth = activeEnrollments.filter((e: any) => e.month === monthStart)
  const studentIds = thisMonth.map((e: any) => e.student_id)
  const monthEnd = `${currentMonthStr}-${String(daysInMonth.length).padStart(2, '0')}`

  const { data: attendance, error: attendanceError } = studentIds.length > 0
    ? await db
        .from('attendance_records')
        .select('student_id, date, status, temperature, absence_reason')
        .in('student_id', studentIds)
        .gte('date', monthStart)
        .lte('date', monthEnd)
    : { data: [], error: null }

  const attendanceByStudent: Record<string, Record<string, string>> = {}
  const temperatureByStudent: Record<string, Record<string, number>> = {}
  const reasonByStudent: Record<string, Record<string, string>> = {}
  for (const rec of attendance ?? []) {
    if (!attendanceByStudent[rec.student_id]) attendanceByStudent[rec.student_id] = {}
    attendanceByStudent[rec.student_id][rec.date] = rec.status
    if (rec.temperature != null) {
      if (!temperatureByStudent[rec.student_id]) temperatureByStudent[rec.student_id] = {}
      temperatureByStudent[rec.student_id][rec.date] = Number(rec.temperature)
    }
    if (rec.absence_reason) {
      if (!reasonByStudent[rec.student_id]) reasonByStudent[rec.student_id] = {}
      reasonByStudent[rec.student_id][rec.date] = rec.absence_reason
    }
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
      enrolledMonths: (allMonthsByStudent[e.student_id] ?? []).sort(),
      days: daysInMonth.map(d => ({
        date: d.date,
        status: attendanceByStudent[e.student_id]?.[d.date] ?? null,
        temperature: temperatureByStudent[e.student_id]?.[d.date] ?? null,
        absenceReason: reasonByStudent[e.student_id]?.[d.date] ?? null,
      })),
    }
  }).sort((a: any, b: any) => a.name.localeCompare(b.name))

  // Stats
  const weekdays = daysInMonth.filter(d => !d.isWeekend && d.date <= todayStr)
  const isWeekday = (date: string) => !daysInMonth.find(d => d.date === date)?.isWeekend
  const presentToday = isWeekday(todayStr)
    ? students.filter((s: any) => attendanceByStudent[s.id]?.[todayStr] === 'present').length
    : null

  const totalSlots = students.length * weekdays.length
  const totalPresent = students.reduce((sum: number, s: any) =>
    sum + weekdays.filter(d => attendanceByStudent[s.id]?.[d.date] === 'present').length, 0)
  const rate = totalSlots > 0 ? Math.round((totalPresent / totalSlots) * 100) : null

  return (
    <main className="mx-auto max-w-7xl p-6 flex flex-col gap-6">
      <div>
        <BackLink href="/admin" label="Dashboard" />
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-xl font-semibold">Attendance</h1>
          <Link
            href={`/admin/enrollment?month=${currentMonthStr}`}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← Enrollment
          </Link>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/attendance?month=${prevMonth}`} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors">‹</Link>
        <span className="text-base font-semibold text-gray-800 min-w-[160px] text-center">{monthLabel}</span>
        <Link href={`/admin/attendance?month=${nextMonth}`} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors">›</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Enrolled', value: students.length, color: '#3B82F6' },
          { label: presentToday !== null ? 'Present Today' : 'Weekdays So Far', value: presentToday !== null ? `${presentToday}/${students.length}` : weekdays.length, color: '#2FA56F' },
          { label: 'Attendance Rate', value: rate !== null ? `${rate}%` : '—', color: '#F59030' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs font-medium text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {attendanceError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load attendance: {attendanceError.message}
        </div>
      )}

      {/* Grid */}
      {students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          No students enrolled for {monthLabel}.
        </div>
      ) : (
        <AttendanceGrid
          students={students}
          daysInMonth={daysInMonth}
          currentMonth={currentMonthStr}
          today={todayStr}
          readOnly={!canChange(role, 'ops.attendance.record')}
        />
      )}
    </main>
  )
}
