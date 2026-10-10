'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParentContext } from '../parent-context'
import { addWeeks, formatWeekLabel } from '@/lib/week'
import { dateStringInBusinessTz } from '@/lib/timezone'
import { parentWeek, sessionsInWeek, type SessionRowLike } from '@/lib/parent-week'
import { WeekGrid } from './week-grid'

export default function CalendarPage() {
  const { kids, selectedChild } = useParentContext()
  // Opens on this week, or on the coming week at the weekend.
  const [weekStart, setWeekStart] = useState(() => parentWeek().weekStart)
  const [rows, setRows] = useState<SessionRowLike[]>([])
  const [loading, setLoading] = useState(true)

  // Load the selected child's sessions
  useEffect(() => {
    if (!selectedChild) { setLoading(false); return }
    const supabase = createClient()
    setLoading(true)
    supabase
      .from('session_plans')
      .select(`
        id, recurrence_type, start_time, end_time,
        day_of_week, time_of_day_start, time_of_day_end, status,
        protocols(title), profiles!session_plans_teacher_id_fkey(name)
      `)
      .eq('student_id', selectedChild.id)
      .in('status', ['pending', 'accepted', 'completed'])
      .then(({ data }) => { setRows((data ?? []) as SessionRowLike[]); setLoading(false) })
  }, [selectedChild])

  const sessions = useMemo(() => sessionsInWeek(rows, weekStart), [rows, weekStart])
  const today = dateStringInBusinessTz(new Date())

  return (
    <div className="flex flex-col bg-gray-50">

      {/* ── Page header ── */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-bold text-gray-800">Calendar</h2>
        <button
          onClick={() => setWeekStart(parentWeek().weekStart)}
          className="text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: '#FEF3E2', color: '#F59030' }}
        >
          Today
        </button>
      </div>

      {/* ── Week navigation ── */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setWeekStart((w) => addWeeks(w, -1))}
          aria-label="Previous week"
          className="w-9 h-9 flex items-center justify-center rounded-full text-lg text-gray-500 hover:bg-gray-100"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-gray-700">{formatWeekLabel(weekStart)}</p>
        <button
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          aria-label="Next week"
          className="w-9 h-9 flex items-center justify-center rounded-full text-lg text-gray-500 hover:bg-gray-100"
        >
          ›
        </button>
      </div>

      {/* ── The whole week as a grid ── */}
      <WeekGrid
        weekStart={weekStart}
        sessions={sessions}
        today={today}
        state={loading ? 'loading' : !selectedChild || kids.length === 0 ? 'no-child' : 'ready'}
      />
    </div>
  )
}
