'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParentContext } from '../parent-context'
import { getWeekStart, addWeeks, formatWeekLabel, dateForDayOfWeek } from '@/lib/week'
import { dateStringInBusinessTz, formatTimeInBusinessTz } from '@/lib/timezone'

// ── Layout constants ───────────────────────────────────────────────────────

const PX_PER_HOUR = 64
const START_HOUR = 8
const END_HOUR = 17
const TOTAL_HOURS = END_HOUR - START_HOUR          // 9 hours visible
const TIMELINE_HEIGHT = TOTAL_HOURS * PX_PER_HOUR  // 576px
const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i)

// Mon–Fri in JS day-of-week convention (matches session_plans.day_of_week)
const WEEKDAYS = [1, 2, 3, 4, 5]
const DAY_SHORT: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' }
const DAY_FULL: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday',
}

// ── Event types & colours ──────────────────────────────────────────────────

type EventCategory = 'therapy' | 'dance' | 'cooking' | 'movement' | 'other'

type CalendarEvent = {
  id: string
  date: string       // YYYY-MM-DD
  startTime: string  // HH:MM
  endTime: string    // HH:MM
  category: EventCategory
  title: string
  subtitle?: string
  status?: string
}

const CATEGORY: Record<EventCategory, { bg: string; border: string; text: string; icon: string }> = {
  therapy:  { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF', icon: '🏥' },
  dance:    { bg: '#F5F3FF', border: '#8B5CF6', text: '#5B21B6', icon: '💃' },
  cooking:  { bg: '#FFF7ED', border: '#F59E0B', text: '#92400E', icon: '🍳' },
  movement: { bg: '#F0FDF4', border: '#10B981', text: '#064E3B', icon: '🤸' },
  other:    { bg: '#F9FAFB', border: '#9CA3AF', text: '#374151', icon: '📌' },
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  accepted:  { bg: '#DBEAFE', text: '#1E40AF' },
  completed: { bg: '#D1FAE5', text: '#065F46' },
  pending:   { bg: '#FEF3C7', text: '#92400E' },
}

// ── Session data shape from Supabase ──────────────────────────────────────

type SessionRow = {
  id: string
  recurrence_type: string
  start_time: string | null
  end_time: string | null
  day_of_week: number | null
  time_of_day_start: string | null
  time_of_day_end: string | null
  status: string
  protocols: { title: string } | { title: string }[] | null
  profiles: { name: string } | { name: string }[] | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pick<T>(v: T | T[] | null, key: keyof (T extends (infer U)[] ? U : T)): string | undefined {
  if (!v) return undefined
  const item = Array.isArray(v) ? v[0] : v
  return item ? String((item as Record<string, unknown>)[key as string] ?? '') || undefined : undefined
}

function todayInBiz(): string { return dateStringInBusinessTz(new Date()) }

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

function eventTop(startTime: string): number {
  return ((timeToMinutes(startTime) - START_HOUR * 60) / 60) * PX_PER_HOUR
}

function eventHeight(startTime: string, endTime: string): number {
  return Math.max(((timeToMinutes(endTime) - timeToMinutes(startTime)) / 60) * PX_PER_HOUR, 32)
}

function formatDayFull(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// Map Supabase session rows → CalendarEvent[], only for the given week
function sessionsToEvents(rows: SessionRow[], weekStart: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const s of rows) {
    const title  = pick(s.protocols, 'title') ?? 'Therapy'
    const teacher = pick(s.profiles, 'name')

    if (s.recurrence_type === 'weekly' && s.day_of_week != null && s.time_of_day_start && s.time_of_day_end) {
      events.push({
        id: s.id,
        date: dateForDayOfWeek(weekStart, s.day_of_week),
        startTime: s.time_of_day_start.slice(0, 5),
        endTime: s.time_of_day_end.slice(0, 5),
        category: 'therapy',
        title, subtitle: teacher, status: s.status,
      })
    } else if (s.recurrence_type === 'one_off' && s.start_time && s.end_time) {
      const start = new Date(s.start_time)
      const end   = new Date(s.end_time)
      events.push({
        id: s.id,
        date: dateStringInBusinessTz(start),
        startTime: formatTimeInBusinessTz(start).slice(0, 5),
        endTime:   formatTimeInBusinessTz(end).slice(0, 5),
        category: 'therapy',
        title, subtitle: teacher, status: s.status,
      })
    }
  }
  return events
}

// Skip weekends when navigating days
function shiftDay(dateStr: string, delta: 1 | -1): string {
  const d = new Date(`${dateStr}T12:00:00`)
  const day = d.getDay()
  const skip = delta === 1
    ? (day === 5 ? 3 : 1)   // Friday → Monday (skip weekend)
    : (day === 1 ? 3 : 1)   // Monday → Friday (skip weekend)
  d.setDate(d.getDate() + delta * skip)
  return dateStringInBusinessTz(d)
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { kids, selectedChild } = useParentContext()
  const [selectedDate, setSelectedDate]   = useState(todayInBiz)
  const [weeklyExpanded, setWeeklyExpanded] = useState(true)
  const [sessions, setSessions]           = useState<SessionRow[]>([])
  const [loading, setLoading]             = useState(true)

  // Week that contains the selected date
  const weekStart = useMemo(
    () => getWeekStart(new Date(`${selectedDate}T12:00:00`)),
    [selectedDate]
  )

  // Load sessions for selected child
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
      .then(({ data }) => { setSessions(data ?? []); setLoading(false) })
  }, [selectedChild?.id])

  // Events for the whole visible week
  const weekEvents = useMemo(
    () => sessionsToEvents(sessions, weekStart),
    [sessions, weekStart]
  )

  // Events for just the selected day, sorted by start time
  const dayEvents = useMemo(
    () => weekEvents
      .filter(e => e.date === selectedDate)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [weekEvents, selectedDate]
  )

  const today = todayInBiz()
  const selectedJsDay = new Date(`${selectedDate}T12:00:00`).getDay()

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Page header ── */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-bold text-gray-800">Calendar</h2>
        <button
          onClick={() => setSelectedDate(today)}
          className="text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: '#FEF3E2', color: '#F59030' }}
        >
          Today
        </button>
      </div>

      {/* ── Weekly strip ── */}
      <div className="bg-white border-b border-gray-100 shadow-sm shrink-0">

        {/* Week range row */}
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={() => setSelectedDate(addWeeks(weekStart, -1))}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            ‹
          </button>
          <button
            onClick={() => setWeeklyExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500"
          >
            {formatWeekLabel(weekStart)}
            <span className="text-gray-400 text-[10px]">{weeklyExpanded ? '▲' : '▼'}</span>
          </button>
          <button
            onClick={() => setSelectedDate(addWeeks(weekStart, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            ›
          </button>
        </div>

        {/* Day buttons */}
        {weeklyExpanded && (
          <div className="grid grid-cols-5 px-2 pb-3 gap-1">
            {WEEKDAYS.map(jsDay => {
              const dateStr   = dateForDayOfWeek(weekStart, jsDay)
              const dayNum    = new Date(`${dateStr}T12:00:00`).getDate()
              const isSelected = dateStr === selectedDate
              const isToday   = dateStr === today
              const hasDot    = weekEvents.some(e => e.date === dateStr)

              return (
                <button
                  key={jsDay}
                  onClick={() => setSelectedDate(dateStr)}
                  className="flex flex-col items-center py-2 rounded-xl transition-all"
                  style={{
                    background: isSelected
                      ? 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)'
                      : isToday ? '#FEF3E2' : 'transparent',
                  }}
                >
                  <span className="text-[9px] font-bold tracking-wide"
                    style={{ color: isSelected ? 'rgba(255,255,255,0.75)' : '#9CA3AF' }}>
                    {DAY_SHORT[jsDay]}
                  </span>
                  <span className="text-sm font-bold mt-0.5"
                    style={{ color: isSelected ? '#fff' : isToday ? '#F59030' : '#1F2937' }}>
                    {dayNum}
                  </span>
                  <div className="h-1 mt-1">
                    {hasDot && (
                      <div className="w-1 h-1 rounded-full"
                        style={{ background: isSelected ? 'rgba(255,255,255,0.7)' : '#F59030' }} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Daily view ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Day label + prev/next */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <button
            onClick={() => setSelectedDate(d => shiftDay(d, -1))}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-800">{DAY_FULL[selectedJsDay]}</p>
            <p className="text-xs text-gray-400">{formatDayFull(selectedDate)}</p>
          </div>
          <button
            onClick={() => setSelectedDate(d => shiftDay(d, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            ›
          </button>
        </div>

        {/* Timeline */}
        <div className="mx-4 mb-8" style={{ position: 'relative', height: TIMELINE_HEIGHT }}>

          {/* Hour lines + labels */}
          {HOURS.map(hour => (
            <div
              key={hour}
              className="absolute left-0 right-0 flex items-center gap-2"
              style={{ top: (hour - START_HOUR) * PX_PER_HOUR, zIndex: 0 }}
            >
              <span className="text-[10px] text-gray-400 w-10 text-right shrink-0 select-none -mt-2">
                {hour}:00
              </span>
              <div className="flex-1 border-t border-gray-100" style={{ marginTop: '-1px' }} />
            </div>
          ))}

          {/* Event area */}
          <div className="absolute" style={{ left: 48, right: 0, top: 0, bottom: 0, zIndex: 1 }}>
            {loading ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                Loading…
              </div>
            ) : !selectedChild || kids.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
                <span className="text-3xl">👶</span>
                <p className="text-xs">No child selected</p>
              </div>
            ) : dayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
                <span className="text-3xl">📅</span>
                <p className="text-xs">No activities this day</p>
              </div>
            ) : (
              dayEvents.map(event => {
                const c      = CATEGORY[event.category]
                const top    = eventTop(event.startTime)
                const height = eventHeight(event.startTime, event.endTime)
                const ss     = event.status ? STATUS_STYLE[event.status] : null

                return (
                  <div
                    key={event.id}
                    className="absolute left-0 right-0 rounded-xl px-2.5 py-1.5 overflow-hidden"
                    style={{
                      top, height,
                      background: c.bg,
                      borderLeft: `3px solid ${c.border}`,
                    }}
                  >
                    <div className="flex flex-col justify-center h-full gap-0.5">
                      {/* Title row */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{c.icon}</span>
                        <p className="text-xs font-bold truncate flex-1" style={{ color: c.text }}>
                          {event.title}
                        </p>
                        {ss && (
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ background: ss.bg, color: ss.text }}
                          >
                            {event.status}
                          </span>
                        )}
                      </div>

                      {/* Teacher */}
                      {event.subtitle && height > 40 && (
                        <p className="text-[10px] truncate" style={{ color: c.border }}>
                          {event.subtitle}
                        </p>
                      )}

                      {/* Time range */}
                      {height > 52 && (
                        <p className="text-[10px] text-gray-400">
                          {event.startTime} – {event.endTime}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
