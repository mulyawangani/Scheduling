/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireNanny } from '@/lib/auth/require-nanny'
import { BehaviorLogForm } from './behavior-log-form'

export const dynamic = 'force-dynamic'

const WIB_OFFSET = 7 * 60 * 60 * 1000

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  behavior:  { bg: '#FEE2E2', text: '#DC2626' },
  hygiene:   { bg: '#E0F2FE', text: '#0369A1' },
  health:    { bg: '#FEF9C3', text: '#CA8A04' },
  milestone: { bg: '#DCFCE7', text: '#15803D' },
}

const SEVERITY_COLORS: Record<string, string> = {
  low: '#16A34A', medium: '#D97706', high: '#DC2626',
}

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

  const [{ data: students }, { data: recentLogs }] = await Promise.all([
    checkedInIds.length > 0
      ? db.from('students')
          .select('id, name, classroom_id, classrooms!students_classroom_id_fkey(name)')
          .in('id', checkedInIds)
          .order('name')
      : Promise.resolve({ data: [] }),

    db.from('behavior_logs')
      .select('id, date, type, severity, description, students!behavior_logs_student_id_fkey(name)')
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

  const logs = recentLogs ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Classroom</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Behavior Log</h1>
        <p className="text-sm text-gray-500 mt-0.5">Record and review behavioral observations.</p>
      </div>

      <BehaviorLogForm students={formStudents} />

      {/* Recent logs */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
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
              const typeStyle = TYPE_STYLES[log.type] ?? { bg: '#F3F4F6', text: '#6B7280' }
              const isToday = log.date === todayStr

              return (
                <div key={log.id}
                  className="flex items-start gap-3 px-4 py-3"
                  style={{ borderBottom: i < logs.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: typeStyle.bg, color: typeStyle.text }}>
                      {log.type.charAt(0).toUpperCase() + log.type.slice(1)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-800">{studentName}</span>
                      {log.severity && (
                        <span className="text-xs font-medium" style={{ color: SEVERITY_COLORS[log.severity] }}>
                          {log.severity}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{log.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {isToday ? 'Today' : log.date}
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
