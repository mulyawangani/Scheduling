import { getUserProfile } from '@/lib/auth/get-user-profile'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

// ── helpers ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const greetingFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', timeZone: BUSINESS_TIMEZONE,
})

const timeFmt = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BUSINESS_TIMEZONE,
})

function timeOfDay() {
  const h = parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: BUSINESS_TIMEZONE }))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function nextOccurrenceLabel(dayOfWeek: number, timeStr: string): string {
  const now = new Date()
  const today = now.getDay()
  let diff = (dayOfWeek - today + 7) % 7
  if (diff === 0) diff = 7
  const next = new Date()
  next.setDate(now.getDate() + diff)
  const [h, m] = timeStr.split(':')
  next.setHours(parseInt(h), parseInt(m), 0, 0)
  const dayLabel = diff === 1 ? 'Tomorrow' : DAY_LABELS[dayOfWeek]
  return `${dayLabel} · ${timeFmt.format(next)}`
}

// ── types ──────────────────────────────────────────────────────────────────

type Child = {
  id: string
  name: string
  nickname: string | null
  status: string
  schools: { name: string } | { name: string }[] | null
}

type Session = {
  id: string
  student_id: string
  recurrence_type: string
  start_time: string | null
  day_of_week: number | null
  time_of_day_start: string | null
  status: string
  protocols: { title: string } | { title: string }[] | null
  profiles: { name: string } | { name: string }[] | null
}

type HNote = {
  session_plan_id: string
  parent_instructions: string
  session_date: string
  student_id: string
}

// ── page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const result = await getUserProfile()
  if (!result) redirect('/login')

  const supabase = await createClient()
  const userId = result.user.id
  const firstName = result.profile.name?.split(' ')[0] ?? 'Parent'

  // Children
  const { data: childRows } = await supabase
    .from('students')
    .select('id, name, nickname, status, schools(name)')
    .eq('parent_id', userId)
    .order('created_at', { ascending: true })

  const children = (childRows ?? []) as unknown as Child[]
  const childIds = children.map(c => c.id)

  // Session plans
  let sessions: Session[] = []
  let homeworkNotes: HNote[] = []

  if (childIds.length > 0) {
    const { data: sessionRows } = await supabase
      .from('session_plans')
      .select('id, student_id, recurrence_type, start_time, day_of_week, time_of_day_start, status, protocols(title), profiles!session_plans_teacher_id_fkey(name)')
      .in('student_id', childIds)
      .in('status', ['pending', 'accepted', 'completed'])
      .order('created_at', { ascending: false })
    sessions = (sessionRows ?? []) as unknown as Session[]

    // Homework from completed sessions
    const completedIds = sessions.filter(s => s.status === 'completed').map(s => s.id)
    if (completedIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { data: noteRows } = await db
        .from('therapy_notes')
        .select('session_plan_id, parent_instructions, session_date')
        .in('session_plan_id', completedIds)
        .not('parent_instructions', 'is', null)
        .order('session_date', { ascending: false })
        .limit(20) as { data: (Omit<HNote, 'student_id'> & { session_plan_id: string })[] | null }

      // Map session_plan_id back to student_id
      const spToStudent = Object.fromEntries(sessions.map(s => [s.id, s.student_id]))
      homeworkNotes = (noteRows ?? []).map(n => ({
        ...n,
        student_id: spToStudent[n.session_plan_id] ?? '',
      }))
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">

      {/* Welcome banner */}
      <div
        className="rounded-3xl px-5 py-5"
        style={{ background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)' }}
      >
        <p className="text-orange-100 text-xs font-semibold tracking-wide mb-0.5">
          {greetingFmt.format(new Date())}
        </p>
        <h1 className="text-white text-xl font-bold">{timeOfDay()}, {firstName} 👋</h1>
        <p className="text-orange-100 text-xs mt-1">
          {children.length === 0
            ? 'No children linked yet'
            : children.length === 1
            ? `Tracking ${(children[0].nickname ?? children[0].name)}'s journey`
            : `Tracking ${children.length} children`}
        </p>
      </div>

      {/* No children */}
      {children.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center" style={{ border: '1px solid #F3F4F6' }}>
          <p className="text-4xl mb-3">👶</p>
          <p className="font-semibold text-gray-700">No children linked</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Contact the school to link your children to your account.</p>
          <Link
            href="/parent/children"
            className="inline-block text-sm font-semibold px-4 py-2 rounded-xl text-white"
            style={{ background: '#F59030' }}
          >
            Go to Children
          </Link>
        </div>
      )}

      {/* Per-child cards */}
      {children.map(child => {
        const schoolName = Array.isArray(child.schools)
          ? child.schools[0]?.name
          : (child.schools as { name: string } | null)?.name

        const childSessions = sessions.filter(s => s.student_id === child.id)
        const upcoming = childSessions.filter(s => s.status === 'pending' || s.status === 'accepted')
        const completed = childSessions.filter(s => s.status === 'completed')

        // Next session to show
        const nextSession = upcoming[0] ?? null
        const protocolTitle = (
          Array.isArray(nextSession?.protocols)
            ? nextSession?.protocols[0]?.title
            : (nextSession?.protocols as { title: string } | null)?.title
        ) ?? null
        const teacherName = (
          Array.isArray(nextSession?.profiles)
            ? nextSession?.profiles[0]?.name
            : (nextSession?.profiles as { name: string } | null)?.name
        ) ?? null

        // Homework for this child
        const hw = homeworkNotes.find(n => n.student_id === child.id)

        return (
          <div key={child.id} className="flex flex-col gap-3">
            {/* Child header */}
            <div className="flex items-center gap-3 px-1">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #F59030, #DC2870)' }}
              >
                {initials(child.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm leading-tight">
                  {child.nickname ?? child.name}
                </p>
                {schoolName && (
                  <p className="text-xs text-gray-400 leading-tight">📍 {schoolName}</p>
                )}
              </div>
              {child.status === 'inactive' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  Inactive
                </span>
              )}
              <Link
                href="/parent/progress"
                className="text-[11px] font-semibold flex-shrink-0"
                style={{ color: '#F59030' }}
              >
                Progress →
              </Link>
            </div>

            {/* Next session */}
            <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #F3F4F6' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Next Session
              </p>
              {nextSession ? (
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ background: 'rgba(245,144,48,0.1)' }}
                  >
                    🏥
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {nextSession.recurrence_type === 'one_off' && nextSession.start_time
                        ? (() => {
                            const d = new Date(nextSession.start_time)
                            const now2 = new Date()
                            const diffDays = Math.round((d.getTime() - now2.getTime()) / 86400000)
                            const label = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : DAY_LABELS[d.getDay()]
                            return `${label} · ${timeFmt.format(d)}`
                          })()
                        : nextSession.day_of_week !== null && nextSession.time_of_day_start
                        ? nextOccurrenceLabel(nextSession.day_of_week, nextSession.time_of_day_start)
                        : '—'}
                    </p>
                    {protocolTitle && (
                      <p className="text-xs text-gray-500 mt-0.5">{protocolTitle}</p>
                    )}
                    {teacherName && (
                      <p className="text-xs text-gray-400 mt-0.5">with {teacherName}</p>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: nextSession.status === 'accepted' ? 'rgba(34,197,94,0.1)' : 'rgba(245,144,48,0.1)',
                      color: nextSession.status === 'accepted' ? '#16a34a' : '#F59030',
                    }}
                  >
                    {nextSession.status === 'accepted' ? 'Confirmed' : 'Pending'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-lg flex-shrink-0">📅</div>
                  <p className="text-sm text-gray-400">No upcoming sessions scheduled</p>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total Sessions', value: childSessions.length, color: '#3B82F6' },
                { label: 'Completed', value: completed.length, color: '#22C55E' },
                { label: 'Upcoming', value: upcoming.length, color: '#F59030' },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="bg-white rounded-2xl p-3 text-center"
                  style={{ border: '1px solid #F3F4F6' }}
                >
                  <p className="text-2xl font-bold leading-none" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                  <p className="text-[9px] font-semibold text-gray-400 mt-1 leading-tight">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Homework reminder */}
            {hw && (
              <div
                className="rounded-2xl p-4"
                style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1.5">
                  📝 Homework Reminder
                </p>
                <p className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">
                  {hw.parent_instructions}
                </p>
              </div>
            )}
          </div>
        )
      })}

      {/* Quick links */}
      {children.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 px-1">
            Quick Access
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { href: '/parent/reports', icon: '📊', label: 'Reports' },
              { href: '/parent/calendar', icon: '📅', label: 'Calendar' },
              { href: '/parent/attendance', icon: '✅', label: 'Attend.' },
              { href: '/parent/messages', icon: '💬', label: 'Messages' },
              { href: '/parent/therapy', icon: '🏥', label: 'Therapy' },
              { href: '/parent/children', icon: '👶', label: 'Children' },
              { href: '/parent/announcements', icon: '📣', label: 'Announce' },
              { href: '/parent/profile', icon: '👤', label: 'Profile' },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="bg-white rounded-2xl p-3 flex flex-col items-center gap-1.5"
                style={{ border: '1px solid #F3F4F6' }}
              >
                <span className="text-xl leading-none">{link.icon}</span>
                <span className="text-[10px] font-semibold text-gray-500 text-center leading-tight">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="text-center pb-2">
        <p className="text-[10px] text-gray-300">
          Academic progress from the Montessori app will appear here after platform merge.
        </p>
      </div>
    </div>
  )
}
