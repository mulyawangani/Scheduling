import Link from 'next/link'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { LogoutButton } from '@/components/logout-button'

const TABS = [
  { href: '/admin/suggestions', label: 'Simulations' },
  { href: '/admin/suggestions/quota', label: 'Quota' },
  { href: '/admin/suggestions/capacity', label: 'Capacity' },
  { href: '/admin/suggestions/rules', label: 'Rules' },
  { href: '/admin/suggestions/recommendation', label: 'Recommendation' },
  { href: '/admin/suggestions/schedules', label: 'Schedules' },
  { href: '/admin/suggestions/reports', label: 'Reports' },
  { href: '/admin/suggestions/billing', label: 'Billing' },
] as const

// The narrower 'admin' role only has these four — everything else
// (Quota/Capacity/Rules/Recommendation) redirects it away via requireOwner()
// on those pages, so hiding them here is just keeping the nav honest about
// what's actually reachable, not the real access boundary.
const ADMIN_VISIBLE_HREFS: ReadonlySet<string> = new Set([
  '/admin/suggestions',
  '/admin/suggestions/schedules',
  '/admin/suggestions/reports',
  '/admin/suggestions/billing',
])

export async function SuggestionsNav({ active }: { active: (typeof TABS)[number]['href'] }) {
  const result = await getUserProfile()
  const isAdmin = result?.profile.role === 'admin'
  const tabs = isAdmin ? TABS.filter((t) => ADMIN_VISIBLE_HREFS.has(t.href)) : TABS

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-gray-200">
      <div className="flex flex-wrap gap-4">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              tab.href === active
                ? 'border-b-2 border-blue-600 pb-2 text-sm font-medium text-blue-600'
                : 'pb-2 text-sm font-medium text-gray-500 hover:text-gray-700'
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {isAdmin && (
        <div className="pb-2">
          <LogoutButton />
        </div>
      )}
    </div>
  )
}
