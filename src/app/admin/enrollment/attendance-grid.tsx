'use client'

import { useTransition } from 'react'
import { markAttendance } from './actions'

const STATUS_COLOR: Record<string, string> = {
  present:  '#2FA56F',
  absent:   '#EF4444',
  late:     '#F59030',
  excused:  '#8B5CF6',
}

const STATUS_CYCLE: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {
  present: 'absent',
  absent:  'present',
  late:    'present',
  excused: 'present',
}

interface AttendanceDay {
  date: string   // YYYY-MM-DD
  status: string | null
}

interface Student {
  id: string
  name: string
  classroom: string | null
  days: AttendanceDay[]
  enrolledMonths: string[]  // YYYY-MM-DD format of month starts
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function AttendanceGrid({
  students,
  daysInMonth,
  currentMonth,
  today,
}: {
  students: Student[]
  daysInMonth: { date: string; label: number; dow: number; isWeekend: boolean }[]
  currentMonth: string   // YYYY-MM
  today: string          // YYYY-MM-DD
}) {
  const [pending, startTransition] = useTransition()

  function toggle(studentId: string, date: string, currentStatus: string | null) {
    if (new Date(date) > new Date(today)) return  // can't mark future
    const next = currentStatus ? STATUS_CYCLE[currentStatus] ?? 'present' : 'present'
    startTransition(() => markAttendance(studentId, date, next))
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-xs font-semibold text-gray-500 min-w-[180px]">
              Student
            </th>
            <th className="px-2 py-3 text-left text-xs font-semibold text-gray-400 min-w-[100px]">
              Enrolled
            </th>
            {daysInMonth.map(d => (
              <th
                key={d.date}
                className={`px-0.5 py-2 text-center font-semibold min-w-[28px] ${d.isWeekend ? 'text-gray-300' : d.date === today ? 'text-orange-500' : 'text-gray-400'}`}
              >
                <div>{d.label}</div>
                <div className="text-[9px] font-normal">{DAY_LABELS[d.dow]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((student, i) => {
            const dayMap: Record<string, string | null> = {}
            student.days.forEach(d => { dayMap[d.date] = d.status })

            // Count this month attendance
            const presentCount = student.days.filter(d => d.status === 'present').length
            const totalMarked = student.days.filter(d => d.status !== null).length

            return (
              <tr key={student.id} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5">
                  <div className="font-medium text-gray-900">{student.name}</div>
                  {student.classroom && (
                    <div className="text-[10px] text-gray-400">{student.classroom}</div>
                  )}
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex gap-1 flex-wrap">
                    {student.enrolledMonths.map(m => {
                      const label = new Date(m + 'T12:00:00').toLocaleString('default', { month: 'short' })
                      const isCurrent = m.startsWith(currentMonth)
                      return (
                        <span
                          key={m}
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                          style={{
                            background: isCurrent ? '#F59030' : '#F3F4F6',
                            color: isCurrent ? 'white' : '#9CA3AF',
                          }}
                        >
                          {label}
                        </span>
                      )
                    })}
                  </div>
                  {totalMarked > 0 && (
                    <div className="text-[9px] text-gray-400 mt-0.5">{presentCount}/{totalMarked} days</div>
                  )}
                </td>
                {daysInMonth.map(d => {
                  const status = dayMap[d.date] ?? null
                  const isFuture = d.date > today
                  const isToday = d.date === today

                  return (
                    <td key={d.date} className="px-0.5 py-2 text-center">
                      {d.isWeekend ? (
                        <span className="text-gray-200">—</span>
                      ) : (
                        <button
                          disabled={isFuture || pending}
                          onClick={() => toggle(student.id, d.date, status)}
                          title={status ?? 'Not marked'}
                          className={`w-5 h-5 rounded-full mx-auto flex items-center justify-center transition-all ${
                            isFuture ? 'cursor-default' : 'hover:scale-110 cursor-pointer'
                          } ${isToday ? 'ring-2 ring-offset-1 ring-orange-300' : ''}`}
                          style={{
                            background: status ? STATUS_COLOR[status] : isFuture ? 'transparent' : '#E5E7EB',
                          }}
                        >
                          {status === 'present' && <span className="text-white text-[9px] font-bold">✓</span>}
                          {status === 'absent'  && <span className="text-white text-[9px] font-bold">✗</span>}
                          {status === 'late'    && <span className="text-white text-[9px] font-bold">L</span>}
                          {status === 'excused' && <span className="text-white text-[9px] font-bold">E</span>}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-50 text-[10px] text-gray-400">
        <span>Click a cell to toggle.</span>
        {Object.entries(STATUS_COLOR).map(([s, c]) => (
          <span key={s} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: c }} />
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        ))}
      </div>
    </div>
  )
}
