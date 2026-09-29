'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { label: 'Profile', icon: '👤', href: '/parent/profile' },
  { label: 'Children', icon: '👶', href: '/parent/children' },
  { label: 'Therapy', icon: '🏥', href: '/parent/therapy' },
  { label: 'Assessment', icon: '📋', href: '/parent/assessment' },
  { label: 'Reports', icon: '📊', href: '/parent/reports' },
  { label: 'Calendar', icon: '📅', href: '/parent/calendar' },
  { label: 'Pictures', icon: '🖼️', href: '/parent/pictures' },
]

export function ParentNav() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-50"
      style={{ boxShadow: '0 -2px 12px rgba(0,0,0,0.06)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {NAV.map(({ label, icon, href }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-w-0 relative"
          >
            <span className="text-xl leading-none">{icon}</span>
            <span
              className="text-[9px] font-semibold leading-none truncate w-full text-center tracking-wide"
              style={{ color: active ? '#F59030' : '#9CA3AF' }}
            >
              {label}
            </span>
            {active && (
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                style={{ background: '#F59030' }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
