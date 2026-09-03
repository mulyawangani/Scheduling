import { createClient } from '@/lib/supabase/server'
import { getProtocolOptionsByStudent } from '@/lib/matching/unmet-needs'
import { getWeekStart, getUpcomingWeekStart } from '@/lib/week'
import { BackLink } from '@/components/back-link'
import { ManualPickerForm } from './manual-picker-form'
import { requireOwner } from '@/lib/auth/require-owner'

export default async function ManualAdditionPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  await requireOwner()
  const { week } = await searchParams
  const supabase = await createClient()
  const weekStartDate = week ? getWeekStart(new Date(`${week}T00:00:00Z`)) : getUpcomingWeekStart()

  const [{ data: studentRows }, { data: protocols }, protocolOptionsByStudent] = await Promise.all([
    supabase.from('students').select('id, name, status').order('name'),
    supabase.from('protocols').select('id, title').order('title'),
    getProtocolOptionsByStudent(supabase, weekStartDate),
  ])

  const students = (studentRows ?? []).filter((s) => s.status !== 'inactive')

  return (
    <main className="mx-auto max-w-lg p-6">
      <BackLink href="/admin/suggestions" label="Scheduling" />
      <h1 className="mb-1 text-xl font-semibold">Manual addition</h1>
      <p className="mb-6 text-sm text-gray-500">
        Pick a child and a protocol to see her real availability against qualified teachers&apos; real availability —
        every teacher shown here, regardless of her weekly or daily quota. Nothing is booked until you approve a
        suggestion or submit the manual override below. A protocol the child already has a session for this month is
        greyed out, so the same protocol doesn&apos;t get scheduled twice before she&apos;s worked through her others.
      </p>
      <ManualPickerForm
        students={students.map((s) => ({ id: s.id, name: s.name }))}
        protocols={protocols ?? []}
        protocolOptionsByStudent={Object.fromEntries(protocolOptionsByStudent)}
        weekStartDate={weekStartDate}
      />
    </main>
  )
}
