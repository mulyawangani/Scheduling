import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'
import { StudentNav } from '../student-nav'

const noteDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TIMEZONE })
const homeworkDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TIMEZONE })

export default async function StudentTherapyNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: student }, { data: sessions }] = await Promise.all([
    supabase.from('students').select('id, name').eq('id', id).single(),
    // Therapy notes are keyed by session_plan_id, not student_id directly —
    // 'completed' is the only status a note can exist for, so this is all
    // that's needed to find them.
    supabase.from('session_plans').select('id').eq('student_id', id).eq('status', 'completed'),
  ])

  if (!student) {
    notFound()
  }

  const sessionIds = (sessions ?? []).map((s) => s.id)
  const { data: therapyNotes } =
    sessionIds.length > 0
      ? await supabase
          .from('therapy_notes')
          .select(
            'id, session_date, review_label, todays_protocol, repatterning_notes, active_notes, parent_instructions, objectives, observations, updated_at, profiles!therapy_notes_teacher_id_fkey(name)'
          )
          .in('session_plan_id', sessionIds)
          .order('session_date', { ascending: false })
          .order('created_at', { ascending: false })
      : { data: [] }

  // The current homework "reminder" isn't just the latest session's note —
  // an older note's homework still stands until a newer one (or a
  // retroactive edit, which bumps updated_at) replaces it. So this picks
  // whichever note with homework was most recently touched, not just the
  // most recent session.
  const currentHomeworkNote = (therapyNotes ?? [])
    .filter((n) => n.parent_instructions)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]

  return (
    <main className="mx-auto max-w-lg p-6">
      <BackLink href="/parent" label="Home" />
      <h1 className="mb-1 text-xl font-semibold">{student.name}</h1>
      <StudentNav studentId={id} active="therapy-notes" />

      {currentHomeworkNote && (
        <section className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-700">
            Homework reminder · updated {homeworkDateFormatter.format(new Date(currentHomeworkNote.updated_at))}
          </p>
          <p className="text-sm text-blue-900">{currentHomeworkNote.parent_instructions}</p>
        </section>
      )}

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
    </main>
  )
}
