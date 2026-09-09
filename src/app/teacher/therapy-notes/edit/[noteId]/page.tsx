import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { BackLink } from '@/components/back-link'
import { BUSINESS_TIMEZONE, businessLocalToISOString } from '@/lib/timezone'
import { dateForDayOfWeek } from '@/lib/week'
import { NoteForm, type NotePrefill } from '../../[sessionId]/note-form'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TIMEZONE })
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: BUSINESS_TIMEZONE,
})

/**
 * Editing an existing note the owner sent back — unlike [sessionId]/page.tsx
 * (which prefills from the *prior* session's note as a template for a new
 * one), this prefills from the note's *own* saved values, since it's the same
 * note being revised, not a new one being written.
 */
export default async function EditTherapyNotePage({ params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params
  const result = await getUserProfile()
  const supabase = await createClient()
  const teacherId = result!.user.id

  const { data: note } = await supabase
    .from('therapy_notes')
    .select(
      'id, session_plan_id, week_start_date, session_date, start_date, duration, review_label, last_session_summary, todays_protocol, repatterning_notes, active_notes, parent_instructions, objectives, observations, status, owner_comment, session_plans(protocol_id, recurrence_type, start_time, day_of_week, time_of_day_start, students(name), protocols(title))'
    )
    .eq('id', noteId)
    .eq('teacher_id', teacherId)
    .single()

  // Editing here is only for a note the owner sent back — an already-accepted
  // or still-pending note shouldn't be silently reset to 'submitted'.
  if (!note || note.status !== 'sent_back') notFound()

  const session = Array.isArray(note.session_plans) ? note.session_plans[0] : note.session_plans
  const student = Array.isArray(session?.students) ? session?.students[0] : session?.students
  const protocol = Array.isArray(session?.protocols) ? session?.protocols[0] : session?.protocols
  const studentName = student?.name ?? 'Unknown student'
  const protocolName = protocol?.title ?? 'Unknown protocol'

  const sessionDateTimeLabel =
    session?.recurrence_type === 'one_off' && session.start_time
      ? dateTimeFormatter.format(new Date(session.start_time))
      : session?.time_of_day_start && note.week_start_date
        ? dateTimeFormatter.format(
            new Date(
              businessLocalToISOString(`${dateForDayOfWeek(note.week_start_date, session.day_of_week as number)}T${session.time_of_day_start.slice(0, 5)}`)
            )
          )
        : null

  const { data: subProtocols } = session?.protocol_id
    ? await supabase.from('sub_protocols').select('id, title').eq('protocol_id', session.protocol_id).eq('is_active', true).order('title')
    : { data: [] }
  const subProtocolTitles = (subProtocols ?? []).map((sp) => sp.title)

  const prefill: NotePrefill = {
    startDate: note.start_date ?? note.session_date,
    duration: note.duration ?? '',
    reviewLabel: note.review_label ?? '',
    lastSessionSummary: note.last_session_summary ?? '',
    todaysProtocol: note.todays_protocol ?? '',
    repatterningNotes: note.repatterning_notes ?? '',
    activeNotes: note.active_notes ?? '',
    parentInstructions: note.parent_instructions ?? '',
    objectives: note.objectives?.length ? note.objectives : [{ objective: '', outcome: '' }],
    observations: note.observations ?? '',
    priorObservations: null,
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <BackLink href="/teacher/therapy-notes" label="Therapy notes" />
        <h1 className="mb-1 text-xl font-semibold">Revise therapy note</h1>
        <p className="text-sm text-gray-500">
          {studentName} — {protocolName} · {sessionDateTimeLabel ?? dateFormatter.format(new Date(`${note.session_date}T00:00:00Z`))}
        </p>
      </div>

      <NoteForm
        sessionId={note.session_plan_id}
        weekStartDate={note.week_start_date}
        sessionDate={note.session_date}
        studentName={studentName}
        protocolName={protocolName}
        subProtocolTitles={subProtocolTitles}
        prefill={prefill}
        editing={{ noteId: note.id, ownerComment: note.owner_comment }}
      />
    </main>
  )
}
