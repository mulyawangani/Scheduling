'use client'

import { useTransition, useState } from 'react'
import { checkInStudent, checkOutStudent, markAbsent } from './actions'

type AttendanceRecord = {
  status: string
  check_in_at: string | null
  check_out_at: string | null
  temperature: number | null
}

type Student = {
  id: string
  name: string
  attendance: AttendanceRecord | null
}

type Classroom = {
  id: string
  name: string
  students: Student[]
}

const WIB_OFFSET = 7 * 60 * 60 * 1000

function toWIBTime(utcStr: string): string {
  const wib = new Date(new Date(utcStr).getTime() + WIB_OFFSET)
  return `${String(wib.getUTCHours()).padStart(2, '0')}:${String(wib.getUTCMinutes()).padStart(2, '0')}`
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    present: { bg: '#DCFCE7', text: '#15803D', label: 'Present' },
    absent:  { bg: '#FEE2E2', text: '#DC2626', label: 'Absent' },
    late:    { bg: '#FEF9C3', text: '#CA8A04', label: 'Late' },
  }
  const s = styles[status] ?? { bg: '#F3F4F6', text: '#9CA3AF', label: 'Not checked in' }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

function StudentRow({ student }: { student: Student }) {
  const [pending, startTransition] = useTransition()
  const [showTemp, setShowTemp] = useState(false)
  const [temp, setTemp] = useState('')

  const att = student.attendance
  const isCheckedIn = att?.status === 'present'
  const isAbsent = att?.status === 'absent'
  const hasCheckOut = !!att?.check_out_at

  function handleCheckIn() {
    if (showTemp) {
      const t = parseFloat(temp)
      startTransition(() => checkInStudent(student.id, isNaN(t) ? null : t))
      setShowTemp(false)
      setTemp('')
    } else {
      setShowTemp(true)
    }
  }

  function handleSkipTemp() {
    startTransition(() => checkInStudent(student.id, null))
    setShowTemp(false)
    setTemp('')
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-b last:border-0 border-gray-50">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
            {student.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-800 truncate">{student.name}</div>
            {att && (
              <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                {att.check_in_at && <span>In {toWIBTime(att.check_in_at)}</span>}
                {att.check_out_at && <span>· Out {toWIBTime(att.check_out_at)}</span>}
                {att.temperature && <span>· {att.temperature}°C</span>}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={att?.status ?? 'none'} />

          {!isCheckedIn && !isAbsent && (
            <>
              <button
                onClick={handleCheckIn}
                disabled={pending}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                style={{ background: '#DCFCE7', color: '#15803D' }}
              >
                {pending ? '...' : showTemp ? 'Confirm' : 'Check In'}
              </button>
              <button
                onClick={() => startTransition(() => markAbsent(student.id))}
                disabled={pending}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                style={{ background: '#FEE2E2', color: '#DC2626' }}
              >
                Absent
              </button>
            </>
          )}

          {isCheckedIn && !hasCheckOut && (
            <button
              onClick={() => startTransition(() => checkOutStudent(student.id))}
              disabled={pending}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{ background: '#FEF3C7', color: '#D97706' }}
            >
              {pending ? '...' : 'Check Out'}
            </button>
          )}
        </div>
      </div>

      {showTemp && !isCheckedIn && (
        <div className="flex items-center gap-2 ml-11">
          <input
            type="number"
            step="0.1"
            min="35"
            max="42"
            placeholder="Temperature °C (optional)"
            value={temp}
            onChange={e => setTemp(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          <button
            onClick={handleSkipTemp}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  )
}

export function CheckInBoard({ classrooms }: { classrooms: Classroom[] }) {
  if (classrooms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
        No active classrooms configured.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {classrooms.map(c => (
        <div key={c.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">{c.name}</h3>
            <span className="text-xs text-gray-400">
              {c.students.filter(s => s.attendance?.status === 'present').length}/{c.students.length} present
            </span>
          </div>
          {c.students.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No students in this classroom.</p>
          ) : (
            c.students.map(s => <StudentRow key={s.id} student={s} />)
          )}
        </div>
      ))}
    </div>
  )
}
