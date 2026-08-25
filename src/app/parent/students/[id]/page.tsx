import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SubProtocol } from '@/lib/supabase/types'
import { BackLink } from '@/components/back-link'
import { BUSINESS_TIMEZONE, dateStringInBusinessTz, dayOfWeekInBusinessTz, formatTimeInBusinessTz } from '@/lib/timezone'
import { StudentEditor } from './student-editor'
import { SessionsList, type SessionRow } from './sessions-list'

const noteDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TIMEZONE })

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

  // Therapy notes are keyed by session_plan_id, not student_id directly, so
  // this reuses the session ids already fetched above (which already
  // includes 'completed' — the only status a note can exist for) rather
  // than a second, separate lookup of this student's sessions.
  const sessionIds = (sessions ?? []).map((s) => s.id)
  const { data: therapyNotes } =
    sessionIds.length > 0
      ? await supabase
          .from('therapy_notes')
          .select(
            'id, session_date, review_label, todays_protocol, repatterning_notes, active_notes, parent_instructions, objectives, observations, profiles!therapy_notes_teacher_id_fkey(name)'
          )
          .in('session_plan_id', sessionIds)
          .order('session_date', { ascending: false })
          .order('created_at', { ascending: false })
      : { data: [] }

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
      <h1 className="mb-6 text-xl font-semibold">{student.name}</h1>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-gray-700">Scheduled sessions</h2>
        <SessionsList studentId={id} sessions={sessionRows} />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-gray-700">Therapy notes</h2>
        {!therapyNotes || therapyNotes.length === 0 ? (
          <p className="text-sm text-gray-500">No therapy notes published yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {therapyNotes.map((n) => {
              const teacher = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles
              const objectives = (n.objectives ?? []) as { objective: string; outcome: string }[]
              return (
                <div key={n.id} className="rounded-lg border border-gray-200 p-4 text-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-gray-900">
                      {noteDateFormatter.format(new Date(`${n.session_date}T00:00:00Z`))}
                      {n.review_label && <span className="ml-1 font-normal text-gray-400">· {n.review_label}</span>}
                    </p>
                    <p className="text-xs text-gray-500">{teacher?.name ?? 'Unknown teacher'}</p>
                  </div>
                  {n.todays_protocol && (
                    <p className="mb-1">
                      <span className="text-xs font-medium text-gray-500">Today&apos;s protocol: </span>
                      {n.todays_protocol}
                    </p>
                  )}
                  {n.repatterning_notes && (
                    <p className="mb-1">
                      <span className="text-xs font-medium text-gray-500">Repatterning: </span>
                      {n.repatterning_notes}
                    </p>
                  )}
                  {n.active_notes && (
                    <p className="mb-1">
                      <span className="text-xs font-medium text-gray-500">Active: </span>
                      {n.active_notes}
                    </p>
                  )}
                  {objectives.length > 0 && (
                    <div className="mt-2">
                      <p className="mb-1 text-xs font-medium text-gray-500">Objectives / outcomes</p>
                      <ul className="flex flex-col gap-1">
                        {objectives.map((o, i) => (
                          <li key={i}>
                            <span className="font-medium">{o.objective}</span>
                            {o.outcome && <span className="text-gray-600"> — {o.outcome}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {n.observations && (
                    <p className="mt-2">
                      <span className="text-xs font-medium text-gray-500">Observations: </span>
                      {n.observations}
                    </p>
                  )}
                  {n.parent_instructions && (
                    <p className="mt-2 rounded-lg bg-blue-50 p-2 text-blue-900">
                      <span className="text-xs font-medium text-blue-700">Homework for you: </span>
                      {n.parent_instructions}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
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
