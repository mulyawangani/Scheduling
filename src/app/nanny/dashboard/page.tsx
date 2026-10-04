/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireNanny } from '@/lib/auth/require-nanny'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const WIB_OFFSET = 7 * 60 * 60 * 1000

export default async function NannyDashboardPage() {
  await requireNanny()
  const db = (await createClient()) as any

  const nowWIB = new Date(Date.now() + WIB_OFFSET)
  const todayStr = nowWIB.toISOString().slice(0, 10)
  const greetingHour = nowWIB.getUTCHours()
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening'

  const [{ data: checkedIn }, { data: logsToday }, { data: classrooms }] = await Promise.all([
    db.from('attendance_records').select('id').eq('date', todayStr).eq('status', 'present'),
    db.from('behavior_logs').select('id').eq('date', todayStr),
    db.from('classrooms').select('id, name').eq('active', true).order('name'),
  ])

  const checkedInCount = (checkedIn ?? []).length
  const logCount = (logsToday ?? []).length
  const classroomList = (classrooms ?? []) as Array<{ id: string; name: string }>

  const stats = [
    { label: 'Students Present', value: checkedInCount, color: '#16ABE3', href: '/nanny/check-in' },
    { label: 'Behavior Logs Today', value: logCount, color: '#E0930B', href: '/nanny/behavior-log' },
    { label: 'Classrooms', value: classroomList.length, color: '#2FA56F', href: '/nanny/check-in' },
  ]

  const quickActions = [
    {
      href: '/nanny/check-in',
      label: 'Student Check-In',
      desc: 'Mark arrivals and departures',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M8.2 12.2l2.6 2.6 5-5.6" />
        </svg>
      ),
    },
    {
      href: '/nanny/behavior-log',
      label: 'Log Behavior',
      desc: 'Record behavioral observations',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      ),
    },
    {
      href: '/nanny/photos',
      label: 'Upload Photos',
      desc: 'Share classroom moments',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Nanny Workspace</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{greeting} 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here&apos;s a quick snapshot of today at Playtics.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="no-underline">
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="text-3xl font-extrabold leading-none" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-gray-400 mt-1.5">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {quickActions.map(a => (
          <Link key={a.href} href={a.href} className="no-underline">
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 flex flex-col gap-2 hover:shadow-md transition-shadow cursor-pointer">
              <div style={{ color: '#16ABE3' }}>{a.icon}</div>
              <div className="font-semibold text-sm text-gray-800">{a.label}</div>
              <div className="text-xs text-gray-400">{a.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Classrooms */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-sm text-gray-800">Classrooms</h2>
        </div>
        {classroomList.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No active classrooms.</p>
        ) : (
          <div>
            {classroomList.map((c, i) => (
              <div key={c.id}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: i < classroomList.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <span className="text-sm font-medium text-gray-800">{c.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
