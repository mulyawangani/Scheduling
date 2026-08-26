import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SubProtocol } from '@/lib/supabase/types'
import { BackLink } from '@/components/back-link'
import { dateStringInBusinessTz, dayOfWeekInBusinessTz, formatTimeInBusinessTz } from '@/lib/timezone'
import { StudentEditor } from './student-editor'
import { SessionsList, type SessionRow } from './sessions-list'
import { StudentNav } from './student-nav'

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: student },
    { data: protocols },
    { data: subProtocols },
    { data: studentProtocols },
    { data: availability },
    { data: sessions },
  ] = await Promise.all([
    supabase.from('students').select('id, name').eq('id', id).single(),
    supabase.from('protocols').select('*').eq('is_active', true).order('title'),
    supabase.from('sub_protocols').select('*').eq('is_active', true).order('title'),
    supabase.from('student_protocols').select('protocol_id, sub_protocol_id').eq('student_id', id),
    supabase.from('student_availability').select('*').eq('student_id', id).order('day_of_week'),
    supabase
      .from('session_plans')
      .select(
        'id, recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end, status, protocols(title), profiles!session_plans_teacher_id_fkey(name)'
      )
      .eq('student_id', id)
      .in('status', ['pending', 'accepted', 'completed'])
      .order('created_at', { ascending: false }),
  ])

  if (!student) {
    notFound()
  }

  const subProtocolsByProtocol: Record<string, SubProtocol[]> = {}
  for (const sp of subProtocols ?? []) {
    ;(subProtocolsByProtocol[sp.protocol_id] ??= []).push(sp)
  }

  const sessionRows: SessionRow[] = (sessions ?? []).map((s) => {
    const isOneOff = s.recurrence_type === 'one_off'
    const start = isOneOff ? new Date(s.start_time as string) : null
    return {
      id: s.id,
      recurrenceType: s.recurrence_type,
      date: start ? dateStringInBusinessTz(start) : null,
      dayOfWeek: start ? dayOfWeekInBusinessTz(start) : (s.day_of_week as number),
      startTime: start ? formatTimeInBusinessTz(start).slice(0, 5) : (s.time_of_day_start as string).slice(0, 5),
      endTime: isOneOff
        ? formatTimeInBusinessTz(new Date(s.end_time as string)).slice(0, 5)
        : (s.time_of_day_end as string).slice(0, 5),
      status: s.status,
      teacherName: (Array.isArray(s.profiles) ? s.profiles[0]?.name : s.profiles?.name) ?? 'Unknown teacher',
      protocolName: (Array.isArray(s.protocols) ? s.protocols[0]?.title : s.protocols?.title) ?? 'Unknown protocol',
    }
  })

  return (
    <main className="mx-auto max-w-lg p-6">
      <BackLink href="/parent" label="Home" />
      <h1 className="mb-1 text-xl font-semibold">{student.name}</h1>
      <StudentNav studentId={id} active="overview" />

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-gray-700">Scheduled sessions</h2>
        <SessionsList studentId={id} sessions={sessionRows} />
      </section>

      <StudentEditor
        studentId={id}
        protocols={protocols ?? []}
        subProtocolsByProtocol={subProtocolsByProtocol}
        selectedKeys={(studentProtocols ?? []).map((s) => s.sub_protocol_id ?? s.protocol_id)}
        availability={availability ?? []}
      />
    </main>
  )
}
