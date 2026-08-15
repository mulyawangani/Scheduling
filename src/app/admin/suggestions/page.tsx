import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUnmetNeeds } from '@/lib/matching/unmet-needs'

const tierLabels: Record<number, string> = { 0: 'Standard', 1: 'Priority', 2: 'VIP' }

export default async function SuggestionsPage() {
  const supabase = await createClient()
  const needs = await getUnmetNeeds(supabase)

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Sessions needing a teacher</h1>
      {needs.length === 0 ? (
        <p className="text-sm text-gray-500">No unmet needs right now.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {needs.map((need) => (
            <li key={`${need.studentId}:${need.subjectId}`} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">
                  {need.studentName} — {need.subjectName}
                </p>
                <p className="text-xs uppercase text-gray-400">
                  {tierLabels[need.parentPriorityTier] ?? need.parentPriorityTier}
                </p>
              </div>
              <Link
                href={`/admin/suggestions/${need.studentId}/${need.subjectId}`}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Assign
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
