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

  const [{ data: session }, { data: profile }] = await Promise.all([
    supabase
      .from('session_plans')
      .select(
        'id, student_id, protocol_id, recurrence_type, start_time, day_of_week, time_of_day_start, status, students(name), protocols(title)'
      )
      .eq('id', sessionId)
      .eq('teacher_id', teacherId)
      .single(),
    supabase.from('profiles').select('requires_note_review').eq('id', teacherId).single(),
  ])

  if (!session || session.status !== 'accepted') notFound()
  if (session.recurrence_type === 'weekly' && !week) notFound()
  const requiresReview = profile?.requires_note_review !== false

  // A note shouldn't be writable for a class that hasn't happened yet —
  // hiding the "Write note" link is only a display convenience, not a real
  // boundary, since this page is reachable directly by URL regardless.
  const today = dateStringInBusinessTz(new Date())
  const occurrenceDate =
    session.recurrence_type === 'one_off'
      ? session.start_time
        ? dateStringInBusinessTz(new Date(session.start_time))
        : null
      : dateForDayOfWeek(week as string, session.day_of_week as number)
  if (occurrenceDate && occurrenceDate > today) notFound()

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

  // The most recent therapy note for this same (student, protocol) —
  // regardless of whether it came from a one-off session or a different week
  // of a weekly-recurring one — so today's note can carry forward fields
  // that usually repeat (homework, technique names, running session count)
  // instead of the teacher retyping them every visit.
  const { data: priorNotes } = await supabase
    .from('therapy_notes')
    .select('*, session_plans!inner(student_id, protocol_id)')
    .eq('session_plans.student_id', session.student_id)
    .eq('session_plans.protocol_id', session.protocol_id)
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
  const priorNote = priorNotes?.[0] ?? null

  // Homework isn't protocol-specific — it's one running set of instructions
  // for the family, same "most recently touched" note the parent app shows
  // as the current homework reminder (see parent/students/[id]/therapy-notes).
  // So whichever teacher wrote it last, for whichever protocol, today's note
  // should start from it too — draft notes don't count since they were never
  // actually sent anywhere.
  const { data: recentHomeworkNotes } = await supabase
    .from('therapy_notes')
    .select('parent_instructions, session_plans!inner(student_id)')
    .eq('session_plans.student_id', session.student_id)
    .neq('status', 'draft')
    .not('parent_instructions', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
  const currentHomework = recentHomeworkNotes?.[0]?.parent_instructions ?? ''

  // Only meaningful as a fallback "when did this protocol start" for a
  // one-off session's very first note — a weekly session has no comparable
  // single start date of its own to fall back on.
  const { data: earliestOneOff } =
    session.recurrence_type === 'one_off'
      ? await supabase
          .from('session_plans')
          .select('start_time')
          .eq('student_id', session.student_id)
          .eq('protocol_id', session.protocol_id)
          .eq('recurrence_type', 'one_off')
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle()
      : { data: null }
  const earliestDate = earliestOneOff?.start_time ? dateStringInBusinessTz(new Date(earliestOneOff.start_time)) : null

  // A draft for this exact occurrence (from an earlier "Save draft") takes
  // over the whole prefill — it's the same note being continued, not a fresh
  // one templated off some other prior session.
  let draftQuery = supabase.from('therapy_notes').select('*').eq('session_plan_id', session.id).eq('teacher_id', teacherId).eq('status', 'draft')
  draftQuery = week ? draftQuery.eq('week_start_date', week) : draftQuery.is('week_start_date', null)
  const { data: draftNote } = await draftQuery.maybeSingle()

  const prefill = draftNote
    ? {
        startDate: draftNote.start_date ?? sessionDate,
        duration: draftNote.duration ?? '',
        reviewLabel: draftNote.review_label ?? '',
        lastSessionSummary: draftNote.last_session_summary ?? '',
        todaysProtocol: draftNote.todays_protocol ?? '',
        repatterningNotes: draftNote.repatterning_notes ?? '',
        activeNotes: draftNote.active_notes ?? '',
        parentInstructions: draftNote.parent_instructions ?? '',
        objectives: draftNote.objectives?.length ? draftNote.objectives : [{ objective: '', outcome: '' }],
        observations: draftNote.observations ?? '',
        priorObservations: priorNote?.observations ?? null,
      }
    : {
        startDate: priorNote?.start_date ?? earliestDate ?? sessionDate,
        duration: priorNote?.duration ?? '',
        reviewLabel: nextReviewLabel(priorNote?.review_label ?? null),
        lastSessionSummary: priorNote
          ? `${dateFormatter.format(new Date(`${priorNote.session_date}T00:00:00Z`))}${priorNote.review_label ? ` - ${priorNote.review_label}` : ''}`
          : '',
        // Always the protocol actually scheduled for this session, not
        // whatever specific text a prior note happened to type in here (e.g.
        // a named sub-protocol) — the teacher can still edit it freely.
        todaysProtocol: protocolName,
        repatterningNotes: priorNote?.repatterning_notes ?? '',
        activeNotes: priorNote?.active_notes ?? '',
        parentInstructions: currentHomework,
        objectives: priorNote?.objectives?.length ? priorNote.objectives.map((o) => ({ objective: o.objective, outcome: '' })) : [{ objective: '', outcome: '' }],
        observations: '',
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
        protocolName={protocolName}
        prefill={prefill}
        requiresReview={requiresReview}
      />
    </main>
  )
}
