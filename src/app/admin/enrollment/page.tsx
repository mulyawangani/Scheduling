/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireAdminOrOwner } from '@/lib/auth/require-admin-or-owner'
import { BackLink } from '@/components/back-link'
import Link from 'next/link'
import { AttendanceGrid } from './attendance-grid'

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

export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  await requireAdminOrOwner()
  const { month: monthParam } = await searchParams

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Parse month from query param or default to current
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

  // Students enrolled this month
  const { data: enrollments } = await db
    .from('enrollments')
    .select(`
      student_id,
      month,
      status,
      students!enrollments_student_id_fkey(
        id, name,
        classroom_id,
        classrooms(name)
      )
    `)
    .gte('month', `${year - 1}-01-01`)
    .lte('month', `${year + 1}-12-01`)
    .eq('status', 'active')

  // Get all enrollment months per student for badge display
  const allEnrollmentsByStudent: Record<string, string[]> = {}
  for (const e of enrollments ?? []) {
    if (!allEnrollmentsByStudent[e.student_id]) allEnrollmentsByStudent[e.student_id] = []
    allEnrollmentsByStudent[e.student_id].push(e.month)
  }

  // Students enrolled THIS month
  const thisMonthEnrollments = (enrollments ?? []).filter((e: any) => e.month === monthStart)

  // Attendance records for this month
  const studentIds = thisMonthEnrollments.map((e: any) => e.student_id)
  const monthEnd = `${currentMonthStr}-${String(daysInMonth.length).padStart(2, '0')}`

  const { data: attendance } = studentIds.length > 0
    ? await db
        .from('attendance_records')
        .select('student_id, date, status')
        .in('student_id', studentIds)
        .gte('date', monthStart)
        .lte('date', monthEnd)
    : { data: [] }

  // Group attendance by student
  const attendanceByStudent: Record<string, Record<string, string>> = {}
  for (const rec of attendance ?? []) {
    if (!attendanceByStudent[rec.student_id]) attendanceByStudent[rec.student_id] = {}
    attendanceByStudent[rec.student_id][rec.date] = rec.status
  }

  // Build student rows
  const students = thisMonthEnrollments.map((e: any) => {
    const student = Array.isArray(e.students) ? e.students[0] : e.students
    const classroom = student?.classrooms
      ? (Array.isArray(student.classrooms) ? student.classrooms[0]?.name : student.classrooms?.name)
      : null
    const studentAttendance = attendanceByStudent[e.student_id] ?? {}

    return {
      id: e.student_id,
      name: student?.name ?? 'Unknown',
      classroom,
      enrolledMonths: (allEnrollmentsByStudent[e.student_id] ?? []).sort(),
      days: daysInMonth.map(d => ({
        date: d.date,
        status: studentAttendance[d.date] ?? null,
      })),
    }
  }).sort((a: any, b: any) => a.name.localeCompare(b.name))

  // Stats
  const weekdays = daysInMonth.filter(d => !d.isWeekend && d.date <= todayStr)
  const todayWeekday = !daysInMonth.find(d => d.date === todayStr)?.isWeekend
  const presentToday = todayWeekday
    ? students.filter((s: any) => attendanceByStudent[s.id]?.[todayStr] === 'present').length
    : null

  const totalAttendanceSlots = students.length * weekdays.length
  const totalPresent = students.reduce((sum: number, s: any) => {
    return sum + weekdays.filter(d => attendanceByStudent[s.id]?.[d.date] === 'present').length
  }, 0)
  const attendanceRate = totalAttendanceSlots > 0
    ? Math.round((totalPresent / totalAttendanceSlots) * 100)
    : null

  return (
    <main className="mx-auto max-w-7xl p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <BackLink href="/admin" label="Dashboard" />
          <h1 className="text-xl font-semibold mt-1">Enrollment &amp; Attendance</h1>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/enrollment?month=${prevMonth}`}
          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          ‹
        </Link>
        <span className="text-base font-semibold text-gray-800 min-w-[160px] text-center">{monthLabel}</span>
        <Link
          href={`/admin/enrollment?month=${nextMonth}`}
          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          ›
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Enrolled', value: students.length, color: '#3B82F6' },
          { label: presentToday !== null ? 'Present Today' : 'Weekdays So Far', value: presentToday !== null ? `${presentToday}/${students.length}` : weekdays.length, color: '#2FA56F' },
          { label: 'Attendance Rate', value: attendanceRate !== null ? `${attendanceRate}%` : '—', color: '#F59030' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold mb-3"
              style={{ background: `${s.color}18`, color: s.color }}
            >
              {typeof s.value === 'number' ? s.value : '●'}
            </div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs font-medium text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

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
        />
      )}
    </main>
  )
}
