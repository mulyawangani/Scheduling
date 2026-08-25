'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { confirmSession, confirmAllSessions } from './actions'
import { getWeekStart, addWeeks, formatWeekLabel, dateForDayOfWeek } from '@/lib/week'
import { dateStringInBusinessTz } from '@/lib/timezone'

const WEEKDAYS = [1, 2, 3, 4, 5]
const DAY_NAMES: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' }
const HOURS = Array.from({ length: 9 }, (_, i) => 8 + i) // 8:00 through 16:00 (last block ends 17:00)
const dateLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' })

export interface TeacherSessionRow {
  id: string
  recurrenceType: 'one_off' | 'weekly'
  date: string | null // YYYY-MM-DD for a one-off session; null for weekly-recurring
  dayOfWeek: number
  startTime: string // "HH:MM"
  endTime: string
  status: string
  studentName: string
  protocolName: string
}

function cellKey(day: number, hour: number) {
  return `${day}-${hour}`
}

function occurrenceKey(sessionId: string, weekStartDate: string) {
  return `${sessionId}:${weekStartDate}`
}

export interface CompletedOccurrence {
  sessionId: string
  weekStartDate: string
}

export function ScheduleCalendar({ sessions, occurrences }: { sessions: TeacherSessionRow[]; occurrences: CompletedOccurrence[] }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isBulkPending, startBulkTransition] = useTransition()
  const router = useRouter()

  function handleConfirm(sessionId: string) {
    setError(null)
    setPendingId(sessionId)
    startTransition(async () => {
      const result = await confirmSession(sessionId)
      setPendingId(null)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleConfirmAll(sessionIds: string[]) {
    if (!confirm(`Confirm all ${sessionIds.length} pending session${sessionIds.length === 1 ? '' : 's'} this week?`)) return
    setError(null)
    startBulkTransition(async () => {
      const result = await confirmAllSessions(sessionIds)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-gray-500">No sessions assigned yet.</p>
  }

  const visibleSessions = sessions.filter((s) => s.recurrenceType !== 'one_off' || s.date === dateForDayOfWeek(weekStart, s.dayOfWeek))

  const byCell = new Map<string, TeacherSessionRow[]>()
  for (const s of visibleSessions) {
    const key = cellKey(s.dayOfWeek, Number(s.startTime.slice(0, 2)))
    const arr = byCell.get(key) ?? []
    arr.push(s)
    byCell.set(key, arr)
  }

  const pendingIdsThisWeek = visibleSessions.filter((s) => s.status === 'pending').map((s) => s.id)

  const completedWeeklyKeys = new Set(occurrences.map((o) => occurrenceKey(o.sessionId, o.weekStartDate)))
  const todayStr = dateStringInBusinessTz(new Date())

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
            <button onClick={() => setWeekStart(getWeekStart(new Date()))} className="text-[11px] text-blue-600 hover:underline">
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

      {pendingIdsThisWeek.length > 0 && (
        <button
          onClick={() => handleConfirmAll(pendingIdsThisWeek)}
          disabled={isPending || isBulkPending}
          className="self-start rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isBulkPending ? 'Confirming…' : `Confirm all (${pendingIdsThisWeek.length})`}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

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
                          const isWeeklyCompletedThisWeek =
                            s.recurrenceType === 'weekly' && completedWeeklyKeys.has(occurrenceKey(s.id, weekStart))
                          const isDone = s.status === 'completed' || isWeeklyCompletedThisWeek
                          const occurrenceInFuture = s.recurrenceType === 'weekly' && dateForDayOfWeek(weekStart, s.dayOfWeek) > todayStr
                          return (
                            <div
                              key={s.id}
                              className={`rounded px-1 py-0.5 ${
                                isDone ? 'bg-green-50 text-green-800' : s.status === 'accepted' ? 'bg-blue-50 text-blue-800' : 'bg-yellow-50 text-yellow-800'
                              }`}
                            >
                              <p className="font-medium leading-tight">{s.protocolName}</p>
                              <p className="leading-tight opacity-80">{s.studentName}</p>
                              <p className="leading-tight text-[9px] uppercase opacity-60">{isDone ? 'completed' : s.status}</p>
                              {s.status === 'pending' && (
                                <button
                                  onClick={() => handleConfirm(s.id)}
                                  disabled={isBulkPending || (isPending && pendingId === s.id)}
                                  className="mt-0.5 text-[10px] text-blue-700 hover:underline disabled:opacity-50"
                                >
                                  Confirm
                                </button>
                              )}
                              {s.status === 'accepted' && s.recurrenceType === 'one_off' && (
                                <Link
                                  href={`/teacher/therapy-notes/${s.id}`}
                                  className="mt-0.5 block text-[10px] text-green-700 hover:underline"
                                >
                                  Write note
                                </Link>
                              )}
                              {s.status === 'accepted' && s.recurrenceType === 'weekly' && !isWeeklyCompletedThisWeek && !occurrenceInFuture && (
                                <Link
                                  href={`/teacher/therapy-notes/${s.id}?week=${weekStart}`}
                                  className="mt-0.5 block text-[10px] text-green-700 hover:underline"
                                >
                                  Write note
                                </Link>
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
