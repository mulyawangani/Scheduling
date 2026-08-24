import Link from 'next/link'

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

export function SuggestionsNav({ active }: { active: (typeof TABS)[number]['href'] }) {
  return (
    <div className="mb-6 flex flex-wrap gap-4 border-b border-gray-200">
      {TABS.map((tab) => (
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
  )
}
