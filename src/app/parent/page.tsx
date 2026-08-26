import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { LogoutButton } from '@/components/logout-button'
import { getWeekStart } from '@/lib/week'

export default async function ParentDashboard() {
  const result = await getUserProfile()
  const supabase = await createClient()

  const weekStart = getWeekStart(new Date())

  const [{ data: students }, { data: sessionRows }] = await Promise.all([
    supabase
      .from('students')
      .select('id, name')
      .eq('parent_id', result!.user.id)
      .order('created_at', { ascending: true }),
    // RLS ("session_plans parent reads own students") already scopes this to
    // this parent's own students, same as everywhere else a parent reads
    // session_plans directly.
    supabase.from('session_plans').select('student_id, status, recurrence_type, start_time'),
  ])

  // A weekly-recurring session has no single date of its own (see the
  // check constraint on session_plans) — while it's still pending
  // confirmation it applies to every week including this one, so it always
  // counts. A one-off session only counts if its date falls in the current
  // week, bucketed the same way admin/page.tsx buckets one-off dates into
  // weeks.
  const statsByStudent = new Map<string, { proposedThisWeek: number; confirmedThisWeek: number; completedTotal: number }>()
  for (const row of sessionRows ?? []) {
    const stats = statsByStudent.get(row.student_id) ?? { proposedThisWeek: 0, confirmedThisWeek: 0, completedTotal: 0 }
    if (row.status === 'completed') stats.completedTotal++
    const inThisWeek = row.recurrence_type === 'weekly' || (row.start_time && getWeekStart(new Date(row.start_time)) === weekStart)
    if (row.status === 'pending' && inThisWeek) stats.proposedThisWeek++
    if (row.status === 'accepted' && inThisWeek) stats.confirmedThisWeek++
    statsByStudent.set(row.student_id, stats)
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your children</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/parent/students/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add child
          </Link>
          <LogoutButton />
        </div>
      </div>

      {!students || students.length === 0 ? (
        <p className="text-sm text-gray-500">No students yet. Add one to get started.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {students.map((student) => {
            const stats = statsByStudent.get(student.id) ?? { proposedThisWeek: 0, confirmedThisWeek: 0, completedTotal: 0 }
            return (
              <li key={student.id} className="p-3">
                <Link href={`/parent/students/${student.id}`} className="font-medium hover:underline">
                  {student.name}
                </Link>
                <p className="text-sm text-gray-500">
                  {stats.proposedThisWeek} proposed this week · {stats.confirmedThisWeek} confirmed this week ·{' '}
                  {stats.completedTotal} session{stats.completedTotal === 1 ? '' : 's'} completed
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
