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

  const [{ data: checkedIn }, { data: absentToday }, { data: logsToday }, { data: classrooms }, { data: allStudents }] = await Promise.all([
    db.from('attendance_records').select('id').eq('date', todayStr).eq('status', 'present'),
    db.from('attendance_records').select('student_id').eq('date', todayStr).eq('status', 'absent'),
    db.from('behavior_logs').select('id').eq('date', todayStr),
    db.from('classrooms').select('id, name, age_group').eq('active', true).order('name'),
    db.from('students').select('id, classroom_id').eq('status', 'student'),
  ])

  const countByClassroom = new Map<string, number>()
  for (const s of allStudents ?? []) {
    countByClassroom.set(s.classroom_id, (countByClassroom.get(s.classroom_id) ?? 0) + 1)
  }

  const checkedInCount = (checkedIn ?? []).length
  const absentIds = new Set((absentToday ?? []).map((a: { student_id: string }) => a.student_id))
  const totalStudents = (allStudents ?? []).filter((s: { id: string }) => !absentIds.has(s.id)).length
  const absentCount = (allStudents ?? []).filter((s: { id: string }) => absentIds.has(s.id)).length
  const logCount = (logsToday ?? []).length
  const classroomList = (classrooms ?? []) as Array<{ id: string; name: string; age_group: string | null }>

  const stats = [
    { label: 'Students Checked In', value: `${checkedInCount}/${totalStudents}`, color: '#16ABE3', href: '/nanny/checked-in' },
    { label: 'Absent', value: absentCount, color: '#EF4444', href: '/nanny/absent' },
    { label: 'Enrollment', value: (allStudents ?? []).length, color: '#8B5CF6', href: '/nanny/check-in' },
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
          <circle cx="12" cy="12" r="9"/><path d="M8.2 12.2l2.6 2.6 5-5.6"/>
        </svg>
      ),
    },
    {
      href: '/nanny/behavior-log',
      label: 'Log Behavior',
      desc: 'Record behavioral observations',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.4 1.8 3.5 1.8 3.5-1.8 3.5-1.8"/><path d="M9 9.5h.01M15 9.5h.01"/>
        </svg>
      ),
    },
    {
      href: '/nanny/photos',
      label: 'Upload Photos',
      desc: 'Share classroom moments',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
        </svg>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ paddingTop: 4, paddingBottom: 28 }}>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Nanny Workspace</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{greeting} 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here&apos;s a quick snapshot of today at Playtics.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 28 }}>
        {stats.map(s => (
          <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer" style={{ height: '100%' }}>
              <div style={{ fontSize: typeof s.value === 'string' ? 26 : 32, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 5 }}>{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
        {quickActions.map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 flex flex-col gap-2 hover:shadow-md transition-shadow cursor-pointer">
              <div style={{ color: '#16ABE3' }}>{a.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{a.label}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{a.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Classrooms overview */}
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
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{c.name}</div>
                  {c.age_group && (
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>{c.age_group}</div>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  {countByClassroom.get(c.id) ?? 0} students
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
