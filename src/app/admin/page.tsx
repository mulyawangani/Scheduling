/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { redirect } from 'next/navigation'
import { NeedsAttention } from './needs-attention'
import { HomeShortcuts } from './home-shortcuts'
import { OwnerDashboard } from './owner-dashboard'
import { BillingBox } from './billing-box'
import { loadBillingSummary } from '@/lib/dashboard/billing-summary'
import { isStaffRole } from '@/lib/auth/permissions'
import { schedulingHome } from '@/lib/auth/admin-nav-config'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const result = await getUserProfile()
  if (!result) redirect('/login')
  const role = result.profile.role
  if (!isStaffRole(role)) redirect('/')

  const supabase = await createClient()
  const firstName = result.profile.name?.split(' ')[0] ?? result.profile.role

  if (result.profile.role === 'admin') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const [{ data: students }, { data: teachers }, { data: classrooms }, { data: announcements }] = await Promise.all([
      supabase.from('students').select('id, status'),
      supabase.from('profiles').select('id').eq('role', 'teacher'),
      db.from('classrooms').select('id, name, active').eq('active', true),
      db.from('announcements').select('id, title, status, created_at').eq('status', 'PUBLISHED').order('created_at', { ascending: false }).limit(5),
    ])

    // The month's money, the same box the Owner sees (Admin may see payments and billing rates).
    const billing = await loadBillingSummary(supabase)

    const totalChildren = students?.length ?? 0
    const statusCounts = {
      none:        students?.filter(s => s.status === null).length ?? 0,
      trial:       students?.filter(s => s.status === 'trial').length ?? 0,
      student:     students?.filter(s => s.status === 'student').length ?? 0,
      non_student: students?.filter(s => s.status === 'non_student').length ?? 0,
      inactive:    students?.filter(s => s.status === 'inactive').length ?? 0,
    }
    const statusBreakdown = [
      { label: 'None',        count: statusCounts.none,        color: '#9CA3AF', bg: '#F3F4F6', param: 'none' },
      { label: 'Trial',       count: statusCounts.trial,       color: '#6366F1', bg: '#EEF2FF', param: 'trial' },
      { label: 'Student',     count: statusCounts.student,     color: '#10B981', bg: '#ECFDF5', param: 'student' },
      { label: 'Non-student', count: statusCounts.non_student, color: '#F59030', bg: '#FFF7ED', param: 'non_student' },
      { label: 'Inactive',    count: statusCounts.inactive,    color: '#EF4444', bg: '#FEF2F2', param: 'inactive' },
    ]

    const sideStats = [
      { label: 'Classrooms', value: classrooms?.length ?? 0, href: '/admin/classrooms', color: '#8B5CF6' },
      { label: 'Teachers',   value: teachers?.length ?? 0,   href: '/admin/teachers',   color: '#F59030' },
    ]

    const quickActions = [
      { label: 'Enrollment', href: '/admin/enrollment', color: '#2FA56F' },
      { label: 'Attendance', href: '/admin/attendance', color: '#14B8A6' },
      { label: 'Billing', href: '/admin/billing', color: '#8B5CF6' },
      { label: 'Manage Classrooms', href: '/admin/classrooms', color: '#8B5CF6' },
      { label: 'Extracurricular Activities', href: '/admin/extracurricular', color: '#06B6D4' },
      { label: 'Announcements', href: '/admin/announcements', color: '#F59030' },
      { label: 'Scheduling', href: schedulingHome(role), color: '#EC4899' },
      { label: 'Manage Students', href: '/admin/children', color: '#3B82F6' },
    ]

    return (
      <main className="mx-auto max-w-4xl p-6 flex flex-col gap-8">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {firstName}</h1>
          <p className="text-sm text-gray-500 mt-1">School admin dashboard</p>
        </div>

        <NeedsAttention role="admin" />

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <Link href="/admin/children" className="flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                style={{ background: '#3B82F618', color: '#3B82F6' }}
              >
                {totalChildren}
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{totalChildren}</div>
                <div className="text-xs font-medium text-gray-500">Children</div>
              </div>
            </Link>
            <div className="grid grid-cols-5 gap-2">
              {statusBreakdown.map((s) => (
                <Link
                  key={s.label}
                  href={`/admin/children?status=${s.param}`}
                  className="rounded-xl p-2.5 text-center hover:opacity-80 transition-opacity"
                  style={{ background: s.bg }}
                >
                  <div className="text-base font-bold" style={{ color: s.color }}>{s.count}</div>
                  <div className="text-[10px] font-medium mt-0.5 leading-tight" style={{ color: s.color }}>{s.label}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {sideStats.map((s) => (
              <Link key={s.label} href={s.href} className="block rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-lg font-bold"
                  style={{ background: `${s.color}18`, color: s.color }}
                >
                  {s.value}
                </div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs font-medium text-gray-500 mt-1">{s.label}</div>
              </Link>
            ))}
          </div>
        </div>

        <BillingBox monthLabel={billing.monthLabel} therapy={billing.therapy} extra={billing.extra} />

        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Recent Announcements</h2>
              <Link href="/admin/announcements" className="text-xs font-semibold text-orange-500">View all →</Link>
            </div>
            {!announcements || announcements.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-gray-400">No published announcements yet.</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {announcements.map((a: any) => (
                  <li key={a.id} className="px-5 py-3">
                    <div className="text-sm font-medium text-gray-800">{a.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="flex flex-col gap-2">
              {quickActions.map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: q.color }} />
                  <span className="text-sm font-medium text-gray-700">{q.label}</span>
                  <svg className="ml-auto text-gray-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (role === 'principal') {
    return (
      <main className="mx-auto max-w-4xl p-6 flex flex-col gap-8">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {firstName}</h1>
          <p className="text-sm text-gray-500 mt-1">Principal dashboard</p>
        </div>
        <NeedsAttention role="principal" />
        <HomeShortcuts role="principal" />
      </main>
    )
  }

  // Owner: the school-wide numbers. The therapy detail is on the Therapy overview.
  return <OwnerDashboard />
}
