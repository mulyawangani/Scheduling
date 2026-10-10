import Link from 'next/link'
import { formatWeekLabel } from '@/lib/week'
import { formatClock, STATUS_LABEL, type WeekSession } from '@/lib/parent-week'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// How a session's status reads to a parent: confirmed, pending, completed or a no-show.
const STATUS_CHIP: Record<string, { bg: string; text: string }> = {
  accepted: { bg: 'rgba(34,197,94,0.1)', text: '#16a34a' },
  pending: { bg: 'rgba(245,144,48,0.1)', text: '#F59030' },
  completed: { bg: 'rgba(59,130,246,0.1)', text: '#2563eb' },
  no_show: { bg: 'rgba(225,29,72,0.1)', text: '#be123c' },
}

/** Every therapy scheduled for the week, in time order, on the parent's Home. */
export function WeekCard({ weekStart, isNextWeek, sessions }: { weekStart: string; isNextWeek: boolean; sessions: WeekSession[] }) {
  return (
    <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #F3F4F6' }}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {isNextWeek ? 'Next week' : 'This week'} · {sessions.length} {sessions.length === 1 ? 'therapy' : 'therapies'}
        </p>
        <p className="text-[10px] text-gray-400">{formatWeekLabel(weekStart)}</p>
      </div>
      {sessions.length > 0 ? (
        <ul className="flex flex-col divide-y divide-gray-50">
          {sessions.map((s) => {
            const chip = STATUS_CHIP[s.status] ?? STATUS_CHIP.pending
            const day = new Date(`${s.date}T12:00:00Z`)
            return (
              <li key={s.id} className="flex items-start gap-3 py-3">
                <div className="w-11 shrink-0 rounded-xl py-1.5 text-center" style={{ background: 'rgba(245,144,48,0.1)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#F59030' }}>
                    {DAY_SHORT[day.getUTCDay()]}
                  </p>
                  <p className="text-base font-bold leading-tight text-gray-800">{day.getUTCDate()}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatClock(s.startTime)}
                    {s.endTime ? ` – ${formatClock(s.endTime)}` : ''}
                  </p>
                  {s.teacher && <p className="text-xs text-gray-400 mt-0.5">with {s.teacher}</p>}
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: chip.bg, color: chip.text }}
                >
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex items-center gap-3 pt-2">
          <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-lg flex-shrink-0">📅</div>
          <p className="text-sm text-gray-400">No therapy scheduled {isNextWeek ? 'next week' : 'this week'}</p>
        </div>
      )}
      <Link href="/parent/calendar" className="mt-2 inline-block text-[11px] font-semibold" style={{ color: '#F59030' }}>
        See the calendar →
      </Link>
    </div>
  )
}
