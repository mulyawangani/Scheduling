'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/logout-button'

const OWNER_LINKS = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/calendar', label: 'Calendar', exact: false },
  { href: '/admin/suggestions', label: 'Scheduling', exact: false },
  { href: '/admin/teachers', label: 'Teachers', exact: false },
  { href: '/admin/protocols', label: 'Protocols', exact: false },
  { href: '/admin/children', label: 'Children', exact: false },
  { href: '/admin/parents', label: 'Parents', exact: false },
  { href: '/admin/therapy-notes', label: 'Therapy Notes', exact: false },
  { href: '/admin/schools', label: 'Schools', exact: false },
  { href: '/admin/audit-log', label: 'Audit Log', exact: false },
]

const ADMIN_LINKS = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/classrooms', label: 'Classrooms', exact: false },
  { href: '/admin/children', label: 'Students', exact: false },
  { href: '/admin/parents', label: 'Parents', exact: false },
  { href: '/admin/teachers', label: 'Teachers', exact: false },
  { href: '/admin/enrollment', label: 'Enrollment', exact: false },
  { href: '/admin/attendance', label: 'Attendance', exact: false },
  { href: '/admin/billing', label: 'Billing', exact: false },
  { href: '/admin/announcements', label: 'Announcements', exact: false },
  { href: '/admin/suggestions', label: 'Scheduling', exact: false },
  { href: '/admin/calendar', label: 'Calendar', exact: false },
]

export function AdminNav({ role }: { role: string }) {
  const pathname = usePathname()
  const links = role === 'owner' ? OWNER_LINKS : ADMIN_LINKS

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 flex items-center gap-1 px-4 py-2 flex-wrap">
      <span
        className="font-black tracking-[0.2em] text-sm mr-3 flex-shrink-0"
        style={{ color: '#F59030' }}
      >
        PLAYTICS
      </span>
      {links.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
        return (
          <Link
            key={l.href}
            href={l.href}
            className="px-2 py-1 rounded-md text-xs font-medium transition-colors flex-shrink-0"
            style={{
              color: active ? '#F59030' : '#6B7280',
              background: active ? 'rgba(245,144,48,0.08)' : 'transparent',
            }}
          >
            {l.label}
          </Link>
        )
      })}
      <div className="ml-auto flex-shrink-0">
        <LogoutButton />
      </div>
    </nav>
  )
}
