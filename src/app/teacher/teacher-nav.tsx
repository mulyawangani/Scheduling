'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/logout-button'

const LINKS = [
  { href: '/teacher', label: 'Sessions', exact: true },
  { href: '/teacher/students', label: 'Students', exact: false },
  { href: '/teacher/availability', label: 'Availability', exact: false },
  { href: '/teacher/therapy-notes', label: 'Therapy Notes', exact: false },
  { href: '/teacher/commissions', label: 'Commissions', exact: false },
  { href: '/teacher/profile', label: 'Profile', exact: false },
]

export function TeacherNav({ name }: { name: string }) {
  const pathname = usePathname()
  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 flex items-center gap-1 px-4 py-2 flex-wrap">
      <span
        className="font-black tracking-[0.2em] text-sm mr-3 flex-shrink-0"
        style={{ color: '#F59030' }}
      >
        PLAYTICS
      </span>
      {LINKS.map((l) => {
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
      <div className="ml-auto flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-gray-400 hidden sm:block">{name}</span>
        <LogoutButton />
      </div>
    </nav>
  )
}
