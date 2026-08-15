import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function scoreColor(score: number | null) {
  if (score === null) return 'bg-gray-100 text-gray-600'
  if (score >= 70) return 'bg-green-50 text-green-700'
  if (score >= 40) return 'bg-yellow-50 text-yellow-700'
  return 'bg-red-50 text-red-700'
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: sessions } = await supabase
    .from('session_plans')
    .select(
      'id, recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end, status, source, match_score, students(name), subjects(name), profiles!session_plans_teacher_id_fkey(name)'
    )
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Owner dashboard</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/admin/suggestions" className="text-blue-600 hover:underline">
            Suggestions
          </Link>
          <Link href="/admin/teachers" className="text-blue-600 hover:underline">
            Teachers
          </Link>
          <Link href="/admin/students" className="text-blue-600 hover:underline">
            Students
          </Link>
          <Link href="/admin/parents" className="text-blue-600 hover:underline">
            Parents
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Active schedule</h2>
        {!sessions || sessions.length === 0 ? (
          <p className="text-sm text-gray-500">No sessions scheduled yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
            {sessions.map((s) => {
              const studentName = Array.isArray(s.students) ? s.students[0]?.name : s.students?.name
              const subjectName = Array.isArray(s.subjects) ? s.subjects[0]?.name : s.subjects?.name
              const teacherName = Array.isArray(s.profiles) ? s.profiles[0]?.name : s.profiles?.name
              const when =
                s.recurrence_type === 'one_off' && s.start_time && s.end_time
                  ? `${dateFormatter.format(new Date(s.start_time))} – ${dateFormatter.format(new Date(s.end_time))}`
                  : `Every ${DAYS[s.day_of_week ?? 0]} ${s.time_of_day_start?.slice(0, 5)}–${s.time_of_day_end?.slice(0, 5)}`
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="font-medium">
                      {studentName} — {subjectName} with {teacherName}
                    </p>
                    <p className="text-sm text-gray-500">{when}</p>
                    <span className="text-xs uppercase text-gray-400">
                      {s.status} · {s.source}
                    </span>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${scoreColor(s.match_score)}`}>
                    {s.match_score === null ? 'unscored' : `${s.match_score}%`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
