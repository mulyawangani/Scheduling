import Link from 'next/link'
import { formatWeekLabel } from '@/lib/week'
import type { NoSessionChild, NoSessionReason } from '@/lib/matching/no-session-report'

interface Group {
  reason: NoSessionReason
  title: string
  help: string
  tone: 'red' | 'amber' | 'gray'
  href: string
  linkLabel: string
}

// Ordered by how much the owner can do about it, most actionable first.
function groups(weekStartDate: string): Group[] {
  const generate = `/admin/suggestions?week=${weekStartDate}`
  return [
    {
      reason: 'availability_outside_week',
      title: "Availability doesn't cover next week",
      help: 'Their only availability is one-time dates outside this week. Ask the parent to add an "every week" window, or add one for them.',
      tone: 'red',
      href: '/admin/children',
      linkLabel: 'Children',
    },
    {
      reason: 'unplaceable',
      title: "Couldn't be placed",
      help: 'They are available, but every qualified teacher is already booked (or the center is at capacity) in those slots — widen their availability, or book by hand.',
      tone: 'red',
      href: '/admin/suggestions/manual',
      linkLabel: 'Manual addition',
    },
    {
      reason: 'no_availability',
      title: 'No availability set',
      help: 'They have protocol needs but no availability windows at all, so no slot can ever fit until one is added.',
      tone: 'red',
      href: '/admin/children',
      linkLabel: 'Children',
    },
    {
      reason: 'proposed',
      title: 'Ready to book',
      help: 'The scheduler can place a session this week — it just has not been booked yet.',
      tone: 'amber',
      href: generate,
      linkLabel: 'Generate schedule',
    },
    {
      reason: 'no_needs',
      title: 'No protocol needs set',
      help: 'Nothing for the scheduler to place. Real children need protocols added; test or duplicate records can be removed.',
      tone: 'gray',
      href: '/admin/children',
      linkLabel: 'Children',
    },
    {
      reason: 'covered',
      title: 'Nothing due this week',
      help: 'Every protocol already has a session this month, so none is due.',
      tone: 'gray',
      href: generate,
      linkLabel: 'Generate schedule',
    },
  ]
}

const TONE: Record<Group['tone'], { badge: string; border: string }> = {
  red: { badge: 'bg-red-100 text-red-700', border: 'border-red-200' },
  amber: { badge: 'bg-amber-100 text-amber-800', border: 'border-amber-200' },
  gray: { badge: 'bg-gray-100 text-gray-600', border: 'border-gray-200' },
}

export function NoSessionPanel({ report, weekStartDate }: { report: NoSessionChild[]; weekStartDate: string }) {
  if (report.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
        ✓ Every active child has a session in the week of {formatWeekLabel(weekStartDate)}.
      </div>
    )
  }

  const byReason = new Map<NoSessionReason, NoSessionChild[]>()
  for (const c of report) byReason.set(c.reason, [...(byReason.get(c.reason) ?? []), c])

  const ATTENTION: NoSessionReason[] = ['availability_outside_week', 'unplaceable', 'no_availability', 'proposed']
  const needsAttention = report.filter((c) => ATTENTION.includes(c.reason)).length
  const containerTone = needsAttention > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'

  return (
    <div className={`rounded-lg border p-4 ${containerTone}`}>
      <h2 className={`text-sm font-semibold ${needsAttention > 0 ? 'text-red-700' : 'text-gray-700'}`}>
        {needsAttention > 0
          ? `⚠ ${needsAttention} ${needsAttention === 1 ? 'child needs' : 'children need'} attention — nothing booked for next week`
          : 'No session next week'}
      </h2>
      <p className="mb-3 text-xs text-gray-500">
        Week of {formatWeekLabel(weekStartDate)} · {report.length} active {report.length === 1 ? 'child has' : 'children have'} nothing booked
      </p>

      <div className="flex flex-col gap-2">
        {groups(weekStartDate).map((g) => {
          const items = byReason.get(g.reason) ?? []
          if (items.length === 0) return null
          const tone = TONE[g.tone]
          return (
            <details key={g.reason} open={g.tone !== 'gray'} className={`rounded-lg border bg-white ${tone.border}`}>
              <summary className="flex cursor-pointer items-center justify-between gap-2 p-3 text-sm font-medium text-gray-800">
                <span>{g.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone.badge}`}>{items.length}</span>
              </summary>
              <div className="border-t border-gray-100 px-3 pb-3 pt-2">
                <p className="mb-2 text-xs text-gray-500">
                  {g.help}{' '}
                  <Link href={g.href} className="text-blue-600 hover:underline">
                    {g.linkLabel} →
                  </Link>
                </p>
                <ul className="flex flex-col gap-1 text-sm">
                  {items.map((c) => (
                    <li key={c.studentId}>
                      <span className="font-medium text-gray-900">{c.studentName}</span>
                      {c.parentName && <span className="text-gray-400"> · {c.parentName}</span>}
                      {c.detail && <span className="block text-xs text-gray-500">{c.detail}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
