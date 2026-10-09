/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/require-capability'
import { BackLink } from '@/components/back-link'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const WIB_OFFSET = 7 * 60 * 60 * 1000

function toWIB(utcStr: string) {
  const utc = new Date(utcStr)
  const wib = new Date(utc.getTime() + WIB_OFFSET)
  return {
    date: wib.toISOString().slice(0, 10),
    hour: wib.getUTCHours(),
    minute: wib.getUTCMinutes(),
    dow: wib.getUTCDay(),
  }
}

function parseTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return { hour: h, minute: m }
}

function slotOf(hour: number, minute: number): number {
  void minute
  if (hour < 8 || hour >= 17) return -1
  return hour - 8
}

function dayCol(dow: number): number { return dow - 1 } // 1(Mon)→0 … 5(Fri)→4

function getMondayOf(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getUTCDay()
  copy.setUTCDate(copy.getUTCDate() - (day === 0 ? 6 : day - 1))
  return copy
}

function isoDate(d: Date): string { return d.toISOString().slice(0, 10) }

const SLOTS = Array.from({ length: 9 }, (_, i) => {
  const h = 8 + i
  return {
    label: `${String(h).padStart(2, '0')}:00`,
    hour: h,
    minute: 0,
    isHour: true,
  }
})

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

type GridEvent = {
  type: 'therapy' | 'lesson_plan' | 'extracurricular'
  label: string
  detail?: string
  status?: string
}

const CHIP: Record<string, { bg: string; text: string; bar: string }> = {
  therapy:        { bg: '#EFF6FF', text: '#1D4ED8', bar: '#3B82F6' },
  lesson_plan:    { bg: '#F0FDF4', text: '#15803D', bar: '#22C55E' },
  extracurricular:{ bg: '#FFF7ED', text: '#C2410C', bar: '#F97316' },
}

const STATUS_OPACITY: Record<string, number> = { pending: 0.65, accepted: 1, completed: 0.85 }

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  await requireCapability('sched.calendar')
  const { week: weekParam } = await searchParams

  const nowUTC = new Date()
  const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET)
  const todayStr = isoDate(nowWIB)

  const monday = weekParam
    ? new Date(weekParam + 'T00:00:00Z')
    : getMondayOf(nowWIB)
  const mondayStr = isoDate(monday)

  const prevMon = new Date(monday); prevMon.setUTCDate(monday.getUTCDate() - 7)
  const nextMon = new Date(monday); nextMon.setUTCDate(monday.getUTCDate() + 7)
  const thisMon = isoDate(getMondayOf(nowWIB))

  const weekDates = DAY_LABELS.map((label, i) => {
    const d = new Date(monday); d.setUTCDate(monday.getUTCDate() + i)
    const ds = isoDate(d)
    return {
      label,
      dateStr: ds,
      display: d.getUTCDate(),
      month: d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }),
      isToday: ds === todayStr,
    }
  })

  // UTC range that covers all of Mon-Fri WIB (Mon midnight WIB = Mon 00:00 - 7h = Sun 17:00 UTC)
  const rangeStart = new Date(monday.getTime() - WIB_OFFSET).toISOString()
  const rangeEnd   = new Date(monday.getTime() + 5 * 86400000 - WIB_OFFSET).toISOString()

  const db = (await createClient()) as any

  const [{ data: oneOff }, { data: weekly }, { data: calEvents }] = await Promise.all([
    db.from('session_plans')
      .select('id, start_time, status, students!session_plans_student_id_fkey(name), protocols!session_plans_protocol_id_fkey(title)')
      .eq('recurrence_type', 'one_off')
      .gte('start_time', rangeStart)
      .lt('start_time', rangeEnd)
      .in('status', ['pending', 'accepted', 'completed']),

    db.from('session_plans')
      .select('id, day_of_week, time_of_day_start, status, students!session_plans_student_id_fkey(name), protocols!session_plans_protocol_id_fkey(title)')
      .eq('recurrence_type', 'weekly')
      .in('status', ['pending', 'accepted'])
      .gte('day_of_week', 1)
      .lte('day_of_week', 5),

    db.from('calendar_events')
      .select('id, type, title, day_of_week, start_time, classrooms(name)')
      .eq('is_active', true)
      .order('start_time'),
  ])

  // Build grid[dayCol 0–4][slot 0–17]
  const grid: GridEvent[][][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 18 }, () => [] as GridEvent[])
  )

  for (const sp of oneOff ?? []) {
    if (!sp.start_time) continue
    const { date, hour, minute, dow } = toWIB(sp.start_time)
    if (!weekDates.some(d => d.dateStr === date)) continue
    const dc = dayCol(dow); const si = slotOf(hour, minute)
    if (dc < 0 || dc > 4 || si < 0) continue
    const student  = Array.isArray(sp.students)  ? sp.students[0]  : sp.students
    const protocol = Array.isArray(sp.protocols) ? sp.protocols[0] : sp.protocols
    grid[dc][si].push({ type: 'therapy', label: student?.name ?? '?', detail: protocol?.title, status: sp.status })
  }

  for (const sp of weekly ?? []) {
    if (sp.day_of_week == null || !sp.time_of_day_start) continue
    const dc = dayCol(sp.day_of_week)
    const { hour, minute } = parseTime(sp.time_of_day_start)
    const si = slotOf(hour, minute)
    if (dc < 0 || dc > 4 || si < 0) continue
    const student  = Array.isArray(sp.students)  ? sp.students[0]  : sp.students
    const protocol = Array.isArray(sp.protocols) ? sp.protocols[0] : sp.protocols
    grid[dc][si].push({ type: 'therapy', label: student?.name ?? '?', detail: protocol?.title, status: sp.status })
  }

  for (const ev of calEvents ?? []) {
    const dc = dayCol(ev.day_of_week)
    const { hour, minute } = parseTime(ev.start_time)
    const si = slotOf(hour, minute)
    if (dc < 0 || dc > 4 || si < 0) continue
    const classroom = ev.classrooms
      ? (Array.isArray(ev.classrooms) ? ev.classrooms[0]?.name : ev.classrooms?.name)
      : null
    grid[dc][si].push({ type: ev.type as 'lesson_plan' | 'extracurricular', label: ev.title, detail: classroom ?? undefined })
  }

  const therapyCount = (oneOff?.length ?? 0) + (weekly?.length ?? 0)
  const lessonCount  = (calEvents ?? []).filter((e: any) => e.type === 'lesson_plan').length / 5 // per day
  const extraCount   = (calEvents ?? []).filter((e: any) => e.type === 'extracurricular').length

  const weekLabel = `${weekDates[0].display} – ${weekDates[4].display} ${weekDates[4].month} ${monday.getUTCFullYear()}`

  return (
    <main className="mx-auto max-w-7xl p-4 flex flex-col gap-4">
      <div>
        <BackLink href="/admin" label="Dashboard" />
        <h1 className="text-xl font-semibold mt-1">Weekly Schedule</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Monday – Friday · 08:00 – 17:00
        </p>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={`/admin/schedule?week=${isoDate(prevMon)}`}
          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors">
          ‹
        </Link>
        <span className="text-sm font-semibold text-gray-800 min-w-[200px]">{weekLabel}</span>
        <Link href={`/admin/schedule?week=${isoDate(nextMon)}`}
          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors">
          ›
        </Link>
        {mondayStr !== thisMon && (
          <Link href={`/admin/schedule?week=${thisMon}`}
            className="ml-1 px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            This week
          </Link>
        )}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-4 flex-wrap">
          {([
            { type: 'therapy',         label: `${therapyCount} therapy sessions` },
            { type: 'lesson_plan',     label: `${Math.round(lessonCount)} lesson plans/day` },
            { type: 'extracurricular', label: `${extraCount} extracurricular` },
          ] as const).map(({ type, label }) => (
            <span key={type} className="flex items-center gap-1.5 text-[11px]" style={{ color: CHIP[type].text }}>
              <span className="inline-block w-3 h-3 rounded" style={{ background: CHIP[type].bg, border: `1.5px solid ${CHIP[type].bar}` }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
        <table className="min-w-[860px] w-full border-collapse" style={{ fontSize: '11px' }}>
          <thead>
            <tr>
              {/* Time header */}
              <th className="w-14 border-b border-r border-gray-100 py-3"
                style={{ background: '#F9FAFB' }} />
              {weekDates.map(d => (
                <th key={d.dateStr}
                  className="border-b border-r last:border-r-0 border-gray-100 py-3 text-center"
                  style={{ background: d.isToday ? 'rgba(245,144,48,0.07)' : '#F9FAFB' }}>
                  <div className="font-semibold" style={{ color: d.isToday ? '#F59030' : '#374151' }}>
                    {d.label}
                  </div>
                  <div className="mt-0.5 font-normal" style={{ color: d.isToday ? '#F59030' : '#9CA3AF', fontSize: '10px' }}>
                    {d.display} {d.month}{d.isToday ? ' ●' : ''}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot, si) => (
              <tr key={slot.label}
                style={{ background: '#FFFFFF' }}>
                {/* Time label */}
                <td className="w-14 border-r border-gray-100 text-right pr-2 align-top"
                  style={{
                    color: '#9CA3AF',
                    paddingTop: '6px',
                    paddingBottom: '4px',
                    borderTop: '1px solid #E5E7EB',
                    fontSize: '10px',
                  }}>
                  <span className="font-semibold">{slot.label}</span>
                </td>

                {weekDates.map((d, di) => {
                  const events = grid[di]?.[si] ?? []
                  return (
                    <td key={d.dateStr}
                      className="border-r last:border-r-0 border-gray-100 align-top"
                      style={{
                        background: d.isToday ? 'rgba(245,144,48,0.025)' : undefined,
                        borderTop: '1px solid #E5E7EB',
                        padding: '4px',
                        minHeight: '52px',
                        verticalAlign: 'top',
                      }}>
                      {events.map((ev, ei) => {
                        const chip = CHIP[ev.type] ?? CHIP.therapy
                        const opacity = ev.status ? (STATUS_OPACITY[ev.status] ?? 1) : 1
                        return (
                          <div key={ei}
                            style={{
                              background: chip.bg,
                              borderLeft: `2.5px solid ${chip.bar}`,
                              borderRadius: '4px',
                              padding: '2px 5px 2px 4px',
                              marginBottom: ei < events.length - 1 ? '2px' : 0,
                              opacity,
                            }}>
                            <div style={{ color: chip.text, fontWeight: 600, lineHeight: 1.3, fontSize: '10px' }}>
                              {ev.label}
                            </div>
                            {ev.detail && (
                              <div style={{ color: chip.text, opacity: 0.7, lineHeight: 1.2, fontSize: '9px' }}>
                                {ev.detail}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Therapy pulled from session plans · Lesson plans &amp; extracurricular from weekly timetable (
        <Link href="/admin/calendar" className="underline">manage holidays →</Link>)
      </p>
    </main>
  )
}
