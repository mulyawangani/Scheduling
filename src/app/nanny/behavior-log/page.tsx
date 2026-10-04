/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireNanny } from '@/lib/auth/require-nanny'
import { BehaviorLogForm } from './behavior-log-form'

export const dynamic = 'force-dynamic'

const WIB_OFFSET = 7 * 60 * 60 * 1000

export default async function NannyBehaviorLogPage() {
  const { user } = await requireNanny()
  const db = (await createClient()) as any

  const todayStr = new Date(Date.now() + WIB_OFFSET).toISOString().slice(0, 10)

  const { data: checkedInToday } = await db
    .from('attendance_records')
    .select('student_id')
    .eq('date', todayStr)
    .neq('status', 'absent')

  const checkedInIds = (checkedInToday ?? []).map((a: any) => a.student_id as string)

  const [{ data: students }, { data: teachers }, { data: recentLogs }] = await Promise.all([
    checkedInIds.length > 0
      ? db.from('students')
          .select('id, name, classroom_id, classrooms!students_classroom_id_fkey(name)')
          .in('id', checkedInIds)
          .order('name')
      : Promise.resolve({ data: [] }),

    db.from('profiles')
      .select('id, name')
      .eq('role', 'teacher')
      .order('name'),

    db.from('behavior_logs')
      .select('id, date, type, activity, sub_activity, severity, description, students!behavior_logs_student_id_fkey(name)')
      .eq('recorded_by_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const formStudents = (students ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    classroom: s.classrooms
      ? (Array.isArray(s.classrooms) ? s.classrooms[0]?.name : s.classrooms?.name)
      : null,
  }))

  const formTeachers = (teachers ?? []).map((t: any) => ({ id: t.id, name: t.name }))
  const logs = recentLogs ?? []

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ paddingTop: 4, paddingBottom: 28 }}>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Classroom</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Behavior Log</h1>
        <p className="text-sm text-gray-500 mt-0.5">Record and review behavioral observations for today&apos;s students.</p>
      </div>

      <BehaviorLogForm students={formStudents} teachers={formTeachers} />

      {/* Recent logs */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-sm text-gray-800">Recent Entries</h2>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No entries yet.</p>
        ) : (
          <div>
            {logs.map((log: any, i: number) => {
              const studentName = log.students
                ? (Array.isArray(log.students) ? log.students[0]?.name : log.students?.name)
                : 'Unknown'
              const typeColor = log.type === 'behavior' ? { bg: '#FEE2E2', text: '#DC2626' }
                : log.type === 'hygiene' ? { bg: '#E0F2FE', text: '#0369A1' }
                : { bg: '#F3F4F6', text: '#6B7280' }

              return (
                <div key={log.id}
                  className="flex items-start gap-3 px-4 py-3"
                  style={{ borderBottom: i < logs.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: typeColor.bg, color: typeColor.text }}>
                      {log.type.charAt(0).toUpperCase() + log.type.slice(1)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{studentName}</span>
                      {log.activity && (
                        <span className="text-xs text-gray-500">{log.activity}</span>
                      )}
                      {log.sub_activity && (
                        <span className="text-xs text-gray-400">· {log.sub_activity}</span>
                      )}
                    </div>
                    {log.description && (
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{log.description}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {log.date === todayStr ? 'Today' : log.date}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
