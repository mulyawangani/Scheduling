import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function TeacherDashboard() {
  const result = await getUserProfile()
  const supabase = await createClient()

  const { data: sessions } = await supabase
    .from('session_plans')
    .select(
      'id, recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end, status, students(name), subjects(name)'
    )
    .eq('teacher_id', result!.user.id)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your sessions</h1>
        <Link href="/teacher/availability" className="text-sm text-blue-600 hover:underline">
          Manage availability
        </Link>
      </div>

      {!sessions || sessions.length === 0 ? (
        <p className="text-sm text-gray-500">No sessions assigned yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {sessions.map((s) => {
            const studentName = Array.isArray(s.students) ? s.students[0]?.name : s.students?.name
            const subjectName = Array.isArray(s.subjects) ? s.subjects[0]?.name : s.subjects?.name
            const when =
              s.recurrence_type === 'one_off' && s.start_time && s.end_time
                ? `${dateFormatter.format(new Date(s.start_time))} – ${dateFormatter.format(new Date(s.end_time))}`
                : `Every ${DAYS[s.day_of_week ?? 0]} ${s.time_of_day_start?.slice(0, 5)}–${s.time_of_day_end?.slice(0, 5)}`
            return (
              <li key={s.id} className="p-3">
                <p className="font-medium">
                  {studentName} — {subjectName}
                </p>
                <p className="text-sm text-gray-500">{when}</p>
                <span className="text-xs uppercase text-gray-400">{s.status}</span>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
