import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { getWeekStart } from '@/lib/week'

export default async function TherapyPage() {
  const result = await getUserProfile()
  const supabase = await createClient()

  const weekStart = getWeekStart(new Date())

  const [{ data: students }, { data: sessionRows }] = await Promise.all([
    supabase
      .from('students')
      .select('id, name, nickname, schools(name)')
      .eq('parent_id', result!.user.id)
      .order('created_at', { ascending: true }),
    supabase.from('session_plans').select('student_id, status, recurrence_type, start_time'),
  ])

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
    <div className="p-5 flex flex-col gap-4">
      <h2 className="text-lg font-bold text-gray-800">Therapy</h2>

      {!students || students.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🏥</p>
          <p className="font-medium">No therapy sessions yet</p>
          <p className="text-sm mt-1">Session details will appear here once scheduled.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {students.map((student) => {
            const stats = statsByStudent.get(student.id) ?? { proposedThisWeek: 0, confirmedThisWeek: 0, completedTotal: 0 }
            const school = (Array.isArray(student.schools) ? student.schools[0]?.name : (student.schools as { name: string } | null)?.name) ?? null
            return (
              <li key={student.id}>
                <Link href={`/parent/therapy/${student.id}`} className="block">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 active:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
                        style={{ background: 'linear-gradient(135deg, #FEF3E2 0%, #FCE4ED 100%)' }}
                      >
                        👶
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">
                          {student.name}
                          {student.nickname ? <span className="text-gray-400 font-normal ml-1">({student.nickname})</span> : null}
                        </p>
                        {school && <p className="text-xs text-gray-400">📍 {school}</p>}
                      </div>
                      <span className="text-gray-300 text-sm">›</span>
                    </div>
                    <div className="mt-3 flex gap-3 text-xs text-gray-500">
                      <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                        {stats.proposedThisWeek} proposed
                      </span>
                      <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
                        {stats.confirmedThisWeek} confirmed
                      </span>
                      <span className="bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                        {stats.completedTotal} done
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
