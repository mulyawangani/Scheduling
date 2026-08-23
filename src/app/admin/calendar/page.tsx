import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { currentMonthParam, addMonths, formatMonthLabel, getMonthGridDays } from '@/lib/calendar-month'
import { HolidayCalendar } from './holiday-calendar'

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams
  const monthParam = month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonthParam()
  const days = getMonthGridDays(monthParam)

  const supabase = await createClient()
  const { data: holidays } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', days[0])
    .lte('date', days[days.length - 1])
    .order('date')

  return (
    <main className="mx-auto max-w-3xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/admin/calendar?month=${addMonths(monthParam, -1)}`} className="text-blue-600 hover:underline">
            ← Prev
          </Link>
          <span className="font-medium text-gray-700">{formatMonthLabel(monthParam)}</span>
          <Link href={`/admin/calendar?month=${addMonths(monthParam, 1)}`} className="text-blue-600 hover:underline">
            Next →
          </Link>
        </div>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        Mark school and public holidays here — Generate schedule on the Suggestions page reads them and adjusts
        availability automatically.
      </p>

      <HolidayCalendar monthParam={monthParam} days={days} holidays={holidays ?? []} />
    </main>
  )
}
