import Link from 'next/link'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { can } from '@/lib/auth/permissions'
import { SCHEDULING_TABS } from '@/lib/auth/admin-nav-config'

// The tabs a role sees come from the permission table. The page guards are the
// real boundary; hiding a tab here only keeps the menu honest.
export async function SuggestionsNav({ active }: { active: string }) {
  const result = await getUserProfile()
  const role = result?.profile.role
  const tabs = SCHEDULING_TABS.filter((t) => can(role, t.need))

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
    </div>
  )
}
