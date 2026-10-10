'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogoutButton } from '@/components/logout-button'
import { navFor } from '@/lib/auth/admin-nav-config'

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', principal: 'Principal' }

// A page is "on" when the address is that page or below it: /admin/therapy must not light up on /admin/therapy-notes.
const isOn = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)

export function AdminNav({ role, name }: { role: string; name: string }) {
  const pathname = usePathname()
  const groups = navFor(role)
  const [open, setOpen] = useState<string | null>(null)

  // Close any open menu when the page changes or Escape is pressed.
  useEffect(() => {
    setOpen(null)
  }, [pathname])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const linkStyle = (active: boolean) => ({
    color: active ? '#F59030' : '#6B7280',
    background: active ? 'rgba(245,144,48,0.08)' : 'transparent',
  })

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 flex items-center gap-1 px-4 py-2 flex-wrap">
      {open && <div className="fixed inset-0 z-30" onClick={() => setOpen(null)} aria-hidden="true" />}
      <span className="font-black tracking-[0.2em] text-sm mr-3 flex-shrink-0" style={{ color: '#F59030' }}>
        PLAYTICS
      </span>

      <Link
        href="/admin"
        className="relative z-40 px-2 py-1 rounded-md text-xs font-medium transition-colors flex-shrink-0"
        style={linkStyle(pathname === '/admin')}
      >
        Dashboard
      </Link>

      {groups.map((g) => {
        const groupActive = g.items.some((i) => isOn(pathname, i.href))

        // A group with a single page is just a link.
        if (g.items.length === 1) {
          const item = g.items[0]
          return (
            <Link
              key={g.key}
              href={item.resolvedHref}
              className="relative z-40 px-2 py-1 rounded-md text-xs font-medium transition-colors flex-shrink-0"
              style={linkStyle(groupActive)}
            >
              {item.label}
            </Link>
          )
        }

        const isOpen = open === g.key
        return (
          <div key={g.key} className="relative flex-shrink-0 z-40">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : g.key)}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              className="px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1"
              style={linkStyle(groupActive || isOpen)}
            >
              {g.label}
              <span aria-hidden="true" className="text-[9px] opacity-70">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-1 min-w-[180px] rounded-lg border border-gray-100 bg-white py-1 shadow-lg"
              >
                {g.items.map((item) => {
                  const active = isOn(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.resolvedHref}
                      role="menuitem"
                      className="block px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                      style={{ color: active ? '#F59030' : '#374151' }}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <div className="relative z-40 ml-auto flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-gray-400 hidden sm:block">
          {name} · {ROLE_LABEL[role] ?? role}
        </span>
        <LogoutButton />
      </div>
    </nav>
  )
}
