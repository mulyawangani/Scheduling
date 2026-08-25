'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelSession } from './actions'
import { getWeekStart, addWeeks, formatWeekLabel, dateForDayOfWeek } from '@/lib/week'

const WEEKDAYS = [1, 2, 3, 4, 5]
const DAY_NAMES: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' }
const HOURS = Array.from({ length: 9 }, (_, i) => 8 + i) // 8:00 through 16:00 (last block ends 17:00)
const dateLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' })

export interface SessionRow {
  id: string
  recurrenceType: 'one_off' | 'weekly'
  date: string | null // YYYY-MM-DD for a one-off session; null for a weekly-recurring one
  dayOfWeek: number // 0-6
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
  status: string
  teacherName: string
  protocolName: string
}

function cellKey(day: number, hour: number) {
  return `${day}-${hour}`
}

export function SessionsList({ studentId, sessions }: { studentId: string; sessions: SessionRow[] }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleCancel(sessionId: string, label: string) {
    if (!confirm(`Cancel "${label}"?`)) return
    setCancelingId(sessionId)
    startTransition(async () => {
      await cancelSession(studentId, sessionId)
      setCancelingId(null)
      router.refresh()
    })
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-gray-500">No sessions scheduled yet.</p>
  }

  const byCell = new Map<string, SessionRow[]>()
  for (const s of sessions) {
    if (s.recurrenceType === 'one_off' && s.date !== dateForDayOfWeek(weekStart, s.dayOfWeek)) continue
    const key = cellKey(s.dayOfWeek, Number(s.startTime.slice(0, 2)))
    const arr = byCell.get(key) ?? []
    arr.push(s)
    byCell.set(key, arr)
  }

  const isCurrentWeek = weekStart === getWeekStart(new Date())

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekStart((w) => addWeeks(w, -1))}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          ← Prev
        </button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-gray-700">{formatWeekLabel(weekStart)}</span>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekStart(getWeekStart(new Date()))}
              className="text-[11px] text-blue-600 hover:underline"
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Next →
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-1"></th>
              {WEEKDAYS.map((day) => (
                <th key={day} className="p-1 text-center font-medium text-gray-600">
                  {DAY_NAMES[day]}
                  <div className="font-normal text-gray-400">
                    {dateLabelFormatter.format(new Date(`${dateForDayOfWeek(weekStart, day)}T00:00:00Z`))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour} className="border-t border-gray-100">
                <td className="whitespace-nowrap p-1 text-right text-gray-500">{hour}:00</td>
                {WEEKDAYS.map((day) => {
                  const here = byCell.get(cellKey(day, hour)) ?? []
                  return (
                    <td key={day} className="p-1 align-top">
                      <div className="flex flex-col gap-1">
                        {here.map((s) => {
                          // Same status coloring as the teacher's and owner's
                          // calendar views: yellow = proposed/pending
                          // confirmation, blue = confirmed, green = completed.
                          const colors =
                            s.status === 'completed'
                              ? { box: 'bg-green-50 text-green-800', sub: 'text-green-600', badge: 'text-green-400' }
                              : s.status === 'accepted'
                                ? { box: 'bg-blue-50 text-blue-800', sub: 'text-blue-600', badge: 'text-blue-400' }
                                : { box: 'bg-yellow-50 text-yellow-800', sub: 'text-yellow-700', badge: 'text-yellow-500' }
                          return (
                            <div key={s.id} className={`rounded px-1 py-0.5 ${colors.box}`}>
                              <p className="font-medium leading-tight">{s.protocolName}</p>
                              <p className={`leading-tight ${colors.sub}`}>{s.teacherName}</p>
                              <p className={`leading-tight text-[9px] uppercase ${colors.badge}`}>{s.status}</p>
                              {s.status !== 'completed' && (
                                <button
                                  onClick={() => handleCancel(s.id, `${s.protocolName} with ${s.teacherName}`)}
                                  disabled={isPending && cancelingId === s.id}
                                  className="mt-0.5 text-[10px] text-red-600 hover:underline disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
