'use client'

import { useTransition, useState } from 'react'
import { checkInStudent, checkOutStudent, markAbsent, undoAttendance } from './actions'

const PALETTE = ['#2FA56F', '#3B82F6', '#E0567E', '#8B6CE6', '#E0930B', '#14B8A6', '#F59E0B', '#EF4444']
function studentColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
function fmtTime(utcStr: string): string {
  const wib = new Date(new Date(utcStr).getTime() + 7 * 3600000)
  return `${String(wib.getUTCHours()).padStart(2, '0')}:${String(wib.getUTCMinutes()).padStart(2, '0')}`
}

const ABSENCE_REASONS = [
  { value: 'sick', label: 'Sick' },
  { value: 'vacation', label: 'Vacation' },
] as const
type AbsenceReason = (typeof ABSENCE_REASONS)[number]['value']

function reasonLabel(reason: string | null): string | null {
  return ABSENCE_REASONS.find(r => r.value === reason)?.label ?? null
}

function ReasonButtons({ onPick, disabled }: { onPick: (reason: AbsenceReason) => void; disabled: boolean }) {
  return (
    <>
      {ABSENCE_REASONS.map(r => (
        <button
          key={r.value}
          onClick={() => onPick(r.value)}
          disabled={disabled}
          className="px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
          style={{ background: '#FEE2E2', color: '#DC2626' }}
        >
          {r.label}
        </button>
      ))}
    </>
  )
}

type AttendanceRecord = {
  status: string
  check_in_at: string | null
  check_out_at: string | null
  temperature: number | null
  physical_note: string | null
  absence_reason: string | null
}

type Student = {
  id: string
  name: string
  attendance: AttendanceRecord | null
}

type Classroom = {
  id: string
  name: string
  ageGroup: string | null
  students: Student[]
}

function StudentRow({ student }: { student: Student }) {
  const [pending, startTransition] = useTransition()
  const [showInputs, setShowInputs] = useState(false)
  const [showReasons, setShowReasons] = useState(false)
  const [temp, setTemp] = useState('')
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const att = student.attendance
  const isIn = att?.status === 'present'
  const isAbsent = att?.status === 'absent'
  const isOut = !!att?.check_out_at

  const color = studentColor(student.name)

  function handleCheckIn() {
    if (showInputs) {
      const t = parseFloat(temp)
      setActionError(null)
      startTransition(async () => {
        const result = await checkInStudent(student.id, isNaN(t) ? null : t, note || null)
        if (result?.error) setActionError(result.error)
      })
      setShowInputs(false)
      setTemp('')
      setNote('')
    } else {
      setShowInputs(true)
      setShowReasons(false)
    }
  }

  function handleAbsent(reason: AbsenceReason) {
    setActionError(null)
    startTransition(async () => {
      const result = await markAbsent(student.id, reason)
      if (result?.error) setActionError(result.error)
    })
    setShowReasons(false)
  }

  function handleSkip() {
    setActionError(null)
    startTransition(async () => {
      const result = await checkInStudent(student.id, null, null)
      if (result?.error) setActionError(result.error)
    })
    setShowInputs(false)
  }

  function handleUndo() {
    setActionError(null)
    startTransition(async () => {
      const result = await undoAttendance(student.id)
      if (result?.error) setActionError(result.error)
    })
  }

  return (
    <div className="px-5 py-3" style={{ borderBottom: '1px solid #F9FAFB' }}>
      <div className="flex items-center gap-3">
        {/* Avatar with status dot */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13, color: '#fff',
          }}>
            {initials(student.name)}
          </div>
          <span style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 10, height: 10, borderRadius: '50%',
            border: '2px solid #fff',
            background: isIn && !isOut ? '#22c55e' : isOut ? '#d1d5db' : isAbsent ? '#ef4444' : '#e5e7eb',
          }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">{student.name}</div>
          {att && (
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
              {att.check_in_at && <span>In {fmtTime(att.check_in_at)}</span>}
              {att.check_out_at && <span>· Out {fmtTime(att.check_out_at)}</span>}
              {att.temperature && <span>· {att.temperature}°C</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isIn && !isAbsent && (
            <>
              <button
                onClick={handleCheckIn}
                disabled={pending}
                className="px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ background: '#DCFCE7', color: '#15803D' }}
              >
                {pending ? '…' : showInputs ? 'Confirm' : 'Check In'}
              </button>
              <button
                onClick={() => {
                  setShowReasons(v => !v)
                  setShowInputs(false)
                }}
                disabled={pending}
                className="px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ background: '#FEE2E2', color: '#DC2626' }}
              >
                Absent
              </button>
            </>
          )}
          {isIn && !isOut && (
            <button
              onClick={() => {
                setActionError(null)
                startTransition(async () => {
                  const result = await checkOutStudent(student.id)
                  if (result?.error) setActionError(result.error)
                })
              }}
              disabled={pending}
              className="px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
              style={{ background: '#FEF3C7', color: '#D97706' }}
            >
              {pending ? '…' : 'Check Out'}
            </button>
          )}
          {isAbsent && (
            <span className="text-xs text-red-400 bg-red-50 px-3 py-1 rounded-lg">
              Absent{att?.absence_reason ? ` · ${reasonLabel(att.absence_reason)}` : ''}
            </span>
          )}
          {isOut && (
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-lg">Done</span>
          )}
          {(isIn || isAbsent) && (
            <button
              onClick={handleUndo}
              disabled={pending}
              title={isOut ? 'Undo check-out' : isIn ? 'Undo check-in (removes temperature and note)' : 'Undo absent'}
              className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap disabled:opacity-50"
            >
              Undo
            </button>
          )}
        </div>
      </div>

      {/* Temperature + note inputs */}
      {showInputs && !isIn && (
        <div className="mt-2 flex gap-2" style={{ paddingLeft: 48 }}>
          <input
            type="number"
            step="0.1"
            min="35"
            max="42"
            placeholder="Temp °C"
            value={temp}
            onChange={e => setTemp(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <input
            type="text"
            placeholder="Physical note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <button
            onClick={handleSkip}
            className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
          >
            Skip
          </button>
        </div>
      )}

      {/* Pick why a child is absent */}
      {showReasons && !isIn && !isAbsent && (
        <div className="mt-2 flex flex-wrap items-center gap-2" style={{ paddingLeft: 48 }}>
          <span className="text-xs text-gray-500">Why is {student.name.split(' ')[0]} absent?</span>
          <ReasonButtons onPick={handleAbsent} disabled={pending} />
          <button
            onClick={() => setShowReasons(false)}
            className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Already absent but no reason recorded yet */}
      {isAbsent && !att?.absence_reason && (
        <div className="mt-2 flex flex-wrap items-center gap-2" style={{ paddingLeft: 48 }}>
          <span className="text-xs text-amber-600">Pick a reason:</span>
          <ReasonButtons onPick={handleAbsent} disabled={pending} />
        </div>
      )}

      {att?.physical_note && (
        <p className="mt-1 text-xs text-amber-600" style={{ paddingLeft: 48 }}>
          📋 {att.physical_note}
        </p>
      )}
      {actionError && (
        <p className="mt-1 text-xs text-red-500" style={{ paddingLeft: 48 }}>
          ⚠️ {actionError}
        </p>
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
      {classrooms.map(c => {
        const checked = c.students.filter(s => s.attendance?.status === 'present').length
        return (
          <div key={c.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-gray-800">{c.name}</div>
                {c.ageGroup && (
                  <div className="text-sm text-gray-500">{c.ageGroup}</div>
                )}
              </div>
              <span className="text-sm font-medium text-gray-500">
                {checked}/{c.students.length} present
              </span>
            </div>
            {c.students.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No students in this classroom.</p>
            ) : (
              c.students.map(s => <StudentRow key={s.id} student={s} />)
            )}
          </div>
        )
      })}
    </div>
  )
}
