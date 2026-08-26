import Link from 'next/link'

export function StudentNav({ studentId, active }: { studentId: string; active: 'overview' | 'therapy-notes' }) {
  const tabs = [
    { key: 'overview' as const, href: `/parent/students/${studentId}`, label: 'Overview' },
    { key: 'therapy-notes' as const, href: `/parent/students/${studentId}/therapy-notes`, label: 'Therapy notes' },
  ]

  return (
    <div className="mb-6 flex gap-4 border-b border-gray-200">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            tab.key === active
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
