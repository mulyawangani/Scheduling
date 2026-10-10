'use client'

import { useEffect, useMemo, useState } from 'react'
import { dateForDayOfWeek } from '@/lib/week'
import { formatClock, STATUS_LABEL, type WeekSession } from '@/lib/parent-week'

// ── Layout constants ───────────────────────────────────────────────────────

const PX_PER_HOUR = 56
const START_HOUR = 8
const END_HOUR = 17
const TIMELINE_HEIGHT = (END_HOUR - START_HOUR) * PX_PER_HOUR
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)
const GUTTER = 34 // width of the hour labels, in px

// Mon–Fri in JS day-of-week convention (matches session_plans.day_of_week)
const WEEKDAYS = [1, 2, 3, 4, 5]
const DAY_SHORT: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' }

const STATUS_THEME: Record<string, { bg: string; border: string; text: string }> = {
  accepted: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E3A8A' },
  completed: { bg: '#D1FAE5', border: '#10B981', text: '#064E3B' },
  pending: { bg: '#FEF3C7', border: '#F59E0B', text: '#78350F' },
  no_show: { bg: '#FFE4E6', border: '#F43F5E', text: '#9F1239' },
}
const FALLBACK_THEME = { bg: '#F3F4F6', border: '#9CA3AF', text: '#374151' }

// ── Helpers ────────────────────────────────────────────────────────────────

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

/** A session with no end time is drawn as one hour. */
function endOf(s: WeekSession): string {
  if (s.endTime) return s.endTime
  const end = Math.min(toMinutes(s.startTime) + 60, 24 * 60 - 1)
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}

function top(startTime: string): number {
  return ((toMinutes(startTime) - START_HOUR * 60) / 60) * PX_PER_HOUR
}

function height(s: WeekSession): number {
  return Math.max(((toMinutes(endOf(s)) - toMinutes(s.startTime)) / 60) * PX_PER_HOUR, 30)
}

type Placed = WeekSession & { lane: number; lanes: number }

/** Sessions that overlap in time on one day share the width of the column side by side. */
function placeDay(sessions: WeekSession[]): Placed[] {
  const sorted = [...sessions].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || toMinutes(endOf(b)) - toMinutes(endOf(a)))
  const placed: Placed[] = []
  let cluster: WeekSession[] = []
  let clusterEnd = -1

  const flush = () => {
    const laneEnds: number[] = []
    const assigned = cluster.map((s) => {
      const start = toMinutes(s.startTime)
      let lane = laneEnds.findIndex((end) => end <= start)
      if (lane === -1) lane = laneEnds.length
      laneEnds[lane] = toMinutes(endOf(s))
      return { s, lane }
    })
    for (const { s, lane } of assigned) placed.push({ ...s, lane, lanes: laneEnds.length })
    cluster = []
    clusterEnd = -1
  }

  for (const s of sorted) {
    if (cluster.length > 0 && toMinutes(s.startTime) >= clusterEnd) flush()
    cluster.push(s)
    clusterEnd = Math.max(clusterEnd, toMinutes(endOf(s)))
  }
  if (cluster.length > 0) flush()
  return placed
}

function dayNumber(date: string): number {
  return Number(date.slice(8, 10))
}

function longDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * The whole week at once: Monday to Friday across, the hours down, every therapy where it falls, so a
 * parent never has to pick a day. Tap a therapy for its details.
 */
export function WeekGrid({
  weekStart,
  sessions,
  today,
  state,
}: {
  weekStart: string
  sessions: WeekSession[]
  /** Today's date, YYYY-MM-DD, to mark the day. */
  today: string
  state: 'loading' | 'no-child' | 'ready'
}) {
  const [selected, setSelected] = useState<WeekSession | null>(null)

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const days = useMemo(
    () =>
      WEEKDAYS.map((jsDay) => {
        const date = dateForDayOfWeek(weekStart, jsDay)
        return { jsDay, date, placed: placeDay(sessions.filter((s) => s.date === date)) }
      }),
    [weekStart, sessions]
  )

  const columns = `${GUTTER}px repeat(5, minmax(0, 1fr))`

  return (
    <div className="mx-auto w-full max-w-5xl px-2 pb-6">
      {/* Day headers */}
      <div className="grid pb-1.5" style={{ gridTemplateColumns: columns }}>
        <div />
        {days.map(({ jsDay, date }) => {
          const isToday = date === today
          return (
            <div key={jsDay} className="flex flex-col items-center py-1.5">
              <span className="text-[10px] font-bold tracking-wide" style={{ color: isToday ? '#F59030' : '#9CA3AF' }}>
                {DAY_SHORT[jsDay]}
              </span>
              <span
                className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
                style={
                  isToday
                    ? { background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)', color: '#fff' }
                    : { color: '#1F2937' }
                }
              >
                {dayNumber(date)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div className="relative rounded-2xl bg-white" style={{ height: TIMELINE_HEIGHT + 16, border: '1px solid #F3F4F6' }}>
        <div className="absolute inset-x-0" style={{ top: 8, height: TIMELINE_HEIGHT }}>
          {/* Hour lines and labels */}
          {HOURS.map((hour) => (
            <div key={hour} className="absolute inset-x-0" style={{ top: (hour - START_HOUR) * PX_PER_HOUR }}>
              <span
                className="absolute select-none text-right text-[10px] text-gray-400"
                style={{ left: 0, width: GUTTER - 6, top: -7 }}
              >
                {hour}:00
              </span>
              <div className="absolute border-t border-gray-100" style={{ left: GUTTER, right: 0 }} />
            </div>
          ))}

          {/* Day columns */}
          <div className="absolute inset-y-0 grid" style={{ left: 0, right: 0, gridTemplateColumns: columns }}>
            <div />
            {days.map(({ jsDay, date, placed }) => (
              <div
                key={jsDay}
                className="relative border-l border-gray-100"
                style={{ background: date === today ? 'rgba(254,243,226,0.55)' : undefined }}
              >
                {placed.map((s) => {
                  const theme = STATUS_THEME[s.status] ?? FALLBACK_THEME
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelected(s)}
                      aria-label={`${s.title}, ${longDate(s.date)}, ${formatClock(s.startTime)}, ${STATUS_LABEL[s.status] ?? s.status}`}
                      className="absolute overflow-hidden rounded-lg px-1 py-1 text-left"
                      style={{
                        top: top(s.startTime),
                        height: height(s),
                        left: `calc(${(s.lane / s.lanes) * 100}% + 1px)`,
                        width: `calc(${100 / s.lanes}% - 2px)`,
                        background: theme.bg,
                        borderLeft: `3px solid ${theme.border}`,
                        color: theme.text,
                      }}
                    >
                      <span className="line-clamp-3 block text-[10px] font-bold leading-tight">{s.title}</span>
                      {height(s) >= 52 && <span className="mt-0.5 block text-[9px] leading-tight opacity-80">{formatClock(s.startTime)}</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {state !== 'ready' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
            {state === 'loading' ? (
              <p className="text-sm">Loading…</p>
            ) : (
              <>
                <span className="text-3xl">👶</span>
                <p className="text-xs">No child selected</p>
              </>
            )}
          </div>
        ) : sessions.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
            <span className="text-3xl">📅</span>
            <p className="text-xs">No therapy scheduled this week</p>
          </div>
        ) : null}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-gray-500">
        {(['accepted', 'pending', 'completed', 'no_show'] as const)
          .filter((status) => status !== 'no_show' || sessions.some((s) => s.status === 'no_show'))
          .map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_THEME[status].bg, border: `1px solid ${STATUS_THEME[status].border}` }} />
            {STATUS_LABEL[status]}
          </span>
        ))}
      </div>

      {/* Details */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={() => setSelected(null)}>
          <div
            role="dialog"
            aria-label={selected.title}
            className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold text-gray-900">{selected.title}</p>
                <p className="mt-1 text-sm text-gray-600">{longDate(selected.date)}</p>
                <p className="text-sm text-gray-600">
                  {formatClock(selected.startTime)}
                  {selected.endTime ? ` – ${formatClock(selected.endTime)}` : ''}
                </p>
                {selected.teacher && <p className="mt-1 text-sm text-gray-500">with {selected.teacher}</p>}
                {selected.status === 'no_show' && (
                  <p className="mt-2 text-xs text-gray-500">Your child did not come to this session and it was not cancelled, so the teacher marked it a no-show.</p>
                )}
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{
                  background: (STATUS_THEME[selected.status] ?? FALLBACK_THEME).bg,
                  color: (STATUS_THEME[selected.status] ?? FALLBACK_THEME).text,
                }}
              >
                {STATUS_LABEL[selected.status] ?? selected.status}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
