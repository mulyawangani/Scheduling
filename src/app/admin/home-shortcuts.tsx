import Link from 'next/link'
import { navFor } from '@/lib/auth/admin-nav-config'
import type { StaffRole } from '@/lib/auth/permissions'

/** Every page the role may open, grouped like the menu, so the dashboard is a map of the whole admin side. */
export function HomeShortcuts({ role }: { role: StaffRole }) {
  const groups = navFor(role)
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-800">Everything you can open</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.key} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{g.label}</p>
            <ul className="flex flex-col gap-1">
              {g.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.resolvedHref} className="text-sm font-medium text-gray-700 hover:text-orange-600">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
