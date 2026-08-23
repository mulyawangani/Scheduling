import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SubProtocol } from '@/lib/supabase/types'
import { BackLink } from '@/components/back-link'
import { ScheduleView, type SessionForSchedule } from './schedule-view'
import { ProtocolsEditor, type AssignedProtocol } from './protocols-editor'
import { ClearScheduleButton } from './clear-schedule-button'
import { addWeeks, formatWeekLabel, getUpcomingWeekStart } from '@/lib/week'

export default async function TeacherDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ week?: string }>
}) {
  const { id } = await params
  const { week } = await searchParams
  const weekStartDate = week || getUpcomingWeekStart()
  const supabase = await createClient()

  const [
    { data: teacher },
    { data: allProtocols },
    { data: allSubProtocols },
    { data: availability },
    { data: sessions },
    { data: assignments },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, email').eq('id', id).eq('role', 'teacher').single(),
    supabase.from('protocols').select('*').order('title'),
    supabase.from('sub_protocols').select('*').order('title'),
    supabase
      .from('teacher_availability')
      .select('*')
      .eq('teacher_id', id)
      .eq('week_start_date', weekStartDate)
      .order('day_of_week'),
    supabase
      .from('session_plans')
      .select(
        'id, recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end, status, students(name), protocols(title)'
      )
      .eq('teacher_id', id)
      .in('status', ['pending', 'accepted', 'completed']),
    supabase
      .from('teacher_protocols')
      .select('id, rating, protocols(title), sub_protocols(title)')
      .eq('teacher_id', id),
  ])

  if (!teacher) {
    notFound()
  }

  const subProtocolsByProtocol: Record<string, SubProtocol[]> = {}
  for (const sp of allSubProtocols ?? []) {
    ;(subProtocolsByProtocol[sp.protocol_id] ??= []).push(sp)
  }

  const sessionRows: SessionForSchedule[] = (sessions ?? []).map((s) => ({
    id: s.id,
    recurrence_type: s.recurrence_type,
    start_time: s.start_time,
    end_time: s.end_time,
    day_of_week: s.day_of_week,
    time_of_day_start: s.time_of_day_start,
    time_of_day_end: s.time_of_day_end,
    status: s.status,
    studentName: (Array.isArray(s.students) ? s.students[0]?.name : s.students?.name) ?? 'Unknown student',
    protocolName: (Array.isArray(s.protocols) ? s.protocols[0]?.title : s.protocols?.title) ?? 'Unknown protocol',
  }))

  const assignedProtocols: AssignedProtocol[] = (assignments ?? []).map((a) => {
    const protocol = Array.isArray(a.protocols) ? a.protocols[0] : a.protocols
    const subProtocol = Array.isArray(a.sub_protocols) ? a.sub_protocols[0] : a.sub_protocols
    return {
      assignmentId: a.id,
      protocolTitle: protocol?.title ?? 'Unknown protocol',
      subProtocolTitle: subProtocol?.title ?? null,
      rating: a.rating,
    }
  })

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-8 p-6">
      <div>
        <BackLink href="/admin/teachers" label="Teachers" />
        <h1 className="mb-1 text-xl font-semibold">{teacher.name}</h1>
        <p className="text-sm text-gray-500">{teacher.email}</p>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-gray-700">Weekly schedule</h2>
          <ClearScheduleButton teacherId={id} teacherName={teacher.name} sessionCount={sessionRows.length} />
        </div>
        <p className="mb-2 text-sm text-gray-500">
          Availability the teacher has uploaded, with any booked sessions shown inline — yellow pending, blue
          accepted, green completed. A session in an amber box fell outside her declared availability for that hour.
        </p>
        <div className="mb-3 flex items-center gap-3 text-sm">
          <Link href={`?week=${addWeeks(weekStartDate, -1)}`} className="text-blue-600 hover:underline">
            ← Prev week
          </Link>
          <span className="font-medium text-gray-700">Week of {formatWeekLabel(weekStartDate)}</span>
          <Link href={`?week=${addWeeks(weekStartDate, 1)}`} className="text-blue-600 hover:underline">
            Next week →
          </Link>
        </div>
        <ScheduleView weekStartDate={weekStartDate} availability={availability ?? []} sessions={sessionRows} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Protocols</h2>
        <p className="mb-2 text-sm text-gray-500">
          Her qualification for a protocol is derived from her assignments here, each with its own 1-5 rating.
          Manage the protocol/sub-protocol library at{' '}
          <Link href="/admin/protocols" className="text-blue-600 hover:underline">
            Protocols
          </Link>
          .
        </p>
        <ProtocolsEditor
          teacherId={id}
          allProtocols={allProtocols ?? []}
          subProtocolsByProtocol={subProtocolsByProtocol}
          assignedProtocols={assignedProtocols}
        />
      </section>
    </main>
  )
}
