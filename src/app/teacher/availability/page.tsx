import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { BackLink } from '@/components/back-link'
import { AvailabilityGrid } from './availability-grid'
import { CopyPreviousWeekButton } from './copy-previous-week-button'
import { addWeeks, formatWeekLabel, getUpcomingWeekStart } from '@/lib/week'

export default async function TeacherAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const weekStartDate = week || getUpcomingWeekStart()

  const result = await getUserProfile()
  const supabase = await createClient()

  const { data: availability } = await supabase
    .from('teacher_availability')
    .select('*')
    .eq('teacher_id', result!.user.id)
    .eq('week_start_date', weekStartDate)
    .order('day_of_week')

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/teacher" label="Home" />
      <h1 className="mb-2 text-xl font-semibold">Your availability</h1>
      <div className="mb-4 flex items-center gap-3 text-sm">
        <Link href={`/teacher/availability?week=${addWeeks(weekStartDate, -1)}`} className="text-blue-600 hover:underline">
          ← Prev week
        </Link>
        <span className="font-medium text-gray-700">Week of {formatWeekLabel(weekStartDate)}</span>
        <Link href={`/teacher/availability?week=${addWeeks(weekStartDate, 1)}`} className="text-blue-600 hover:underline">
          Next week →
        </Link>
      </div>
      <div className="mb-6">
        <CopyPreviousWeekButton weekStartDate={weekStartDate} />
      </div>
      <AvailabilityGrid
        key={`${weekStartDate}-${(availability ?? []).map((a) => `${a.day_of_week}:${a.start_time}`).join(',')}`}
        weekStartDate={weekStartDate}
        availability={availability ?? []}
      />
    </main>
  )
}
