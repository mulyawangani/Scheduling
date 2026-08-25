import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { BackLink } from '@/components/back-link'
import { BUSINESS_TIMEZONE, dateStringInBusinessTz, businessLocalToISOString } from '@/lib/timezone'
import { dateForDayOfWeek } from '@/lib/week'
import { NoteForm } from './note-form'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TIMEZONE })
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: BUSINESS_TIMEZONE,
})

/** "S07 (F)" -> "S08" — carries the running session count forward; anything it can't parse, it leaves for the teacher to fill by hand. */
function nextReviewLabel(prev: string | null): string {
  const match = prev?.match(/S(\d+)/i)
  if (!match) return ''
  const n = Number(match[1]) + 1
  return `S${String(n).padStart(2, '0')}`
}

export default async function TherapyNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ week?: string }>
}) {
  const { sessionId } = await params
  const { week } = await searchParams
  const result = await getUserProfile()
  const supabase = await createClient()
  const teacherId = result!.user.id

  const { data: session } = await supabase
    .from('session_plans')
    .select(
      'id, student_id, protocol_id, recurrence_type, start_time, day_of_week, time_of_day_start, status, students(name), protocols(title)'
    )
    .eq('id', sessionId)
    .eq('teacher_id', teacherId)
    .single()

  if (!session || session.status !== 'accepted') notFound()
  if (session.recurrence_type === 'weekly' && !week) notFound()

  const student = Array.isArray(session.students) ? session.students[0] : session.students
  const protocol = Array.isArray(session.protocols) ? session.protocols[0] : session.protocols
  const studentName = student?.name ?? 'Unknown student'
  const protocolName = protocol?.title ?? 'Unknown protocol'

  const sessionDateTimeLabel =
    session.recurrence_type === 'one_off' && session.start_time
      ? dateTimeFormatter.format(new Date(session.start_time))
      : session.time_of_day_start
        ? dateTimeFormatter.format(
            new Date(businessLocalToISOString(`${dateForDayOfWeek(week as string, session.day_of_week as number)}T${session.time_of_day_start.slice(0, 5)}`))
          )
        : null

  const sessionDate =
    session.recurrence_type === 'one_off'
      ? dateStringInBusinessTz(new Date(session.start_time as string))
      : dateForDayOfWeek(week as string, session.day_of_week as number)

  // Every prior session for this same (student, protocol) — used to find the
  // most recent therapy note for it, so today's note can carry forward
  // fields that usually repeat (homework, technique names, running session
  // count) instead of the teacher retyping them every visit.
  const { data: relatedSessions } = await supabase
    .from('session_plans')
    .select('id, start_time')
    .eq('student_id', session.student_id)
    .eq('protocol_id', session.protocol_id)
    .eq('recurrence_type', 'one_off')
    .order('start_time', { ascending: true })
  const relatedIds = (relatedSessions ?? []).map((r) => r.id)
  const earliestDate = relatedSessions?.[0]?.start_time ? dateStringInBusinessTz(new Date(relatedSessions[0].start_time)) : null

  const { data: priorNotes } =
    relatedIds.length > 0
      ? await supabase
          .from('therapy_notes')
          .select('*')
          .in('session_plan_id', relatedIds)
          .order('session_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
      : { data: [] }
  const priorNote = priorNotes?.[0] ?? null

  const prefill = {
    startDate: priorNote?.start_date ?? earliestDate ?? sessionDate,
    duration: priorNote?.duration ?? '',
    reviewLabel: nextReviewLabel(priorNote?.review_label ?? null),
    lastSessionSummary: priorNote
      ? `${dateFormatter.format(new Date(`${priorNote.session_date}T00:00:00Z`))}${priorNote.review_label ? ` - ${priorNote.review_label}` : ''}`
      : '',
    todaysProtocol: protocolName,
    repatterningNotes: priorNote?.repatterning_notes ?? '',
    activeNotes: priorNote?.active_notes ?? '',
    parentInstructions: priorNote?.parent_instructions ?? '',
    objectives: priorNote?.objectives?.length ? priorNote.objectives.map((o) => ({ objective: o.objective, outcome: '' })) : [{ objective: '', outcome: '' }],
    priorObservations: priorNote?.observations ?? null,
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <BackLink href="/teacher/therapy-notes" label="Therapy notes" />
        <h1 className="mb-1 text-xl font-semibold">Therapy note</h1>
        <p className="text-sm text-gray-500">
          {studentName} — {protocolName} · {sessionDateTimeLabel ?? dateFormatter.format(new Date(`${sessionDate}T00:00:00Z`))}
        </p>
      </div>

      <NoteForm
        sessionId={session.id}
        weekStartDate={session.recurrence_type === 'weekly' ? (week as string) : null}
        sessionDate={sessionDate}
        studentName={studentName}
        prefill={prefill}
      />
    </main>
  )
}
