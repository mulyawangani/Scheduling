import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'
import { NotesList, type NoteRow } from './notes-list'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TIMEZONE })

export default async function AdminTherapyNotesPage() {
  const supabase = await createClient()

  const { data: notes } = await supabase
    .from('therapy_notes')
    .select(
      'id, session_date, review_label, todays_protocol, observations, parent_instructions, created_at, profiles!therapy_notes_teacher_id_fkey(name), session_plans(students(name), protocols(title))'
    )
    .order('created_at', { ascending: false })
    .limit(150)

  const rows: NoteRow[] = (notes ?? []).map((n) => {
    const teacher = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles
    const sp = Array.isArray(n.session_plans) ? n.session_plans[0] : n.session_plans
    const student = Array.isArray(sp?.students) ? sp?.students[0] : sp?.students
    const protocol = Array.isArray(sp?.protocols) ? sp?.protocols[0] : sp?.protocols
    return {
      id: n.id,
      dateLabel: dateFormatter.format(new Date(`${n.session_date}T00:00:00Z`)),
      studentName: student?.name ?? 'Unknown student',
      teacherName: teacher?.name ?? 'Unknown teacher',
      protocolName: n.todays_protocol || protocol?.title || 'Unknown protocol',
      reviewLabel: n.review_label,
      observations: n.observations,
      parentInstructions: n.parent_instructions,
    }
  })

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Therapy notes</h1>
      <p className="mb-4 text-sm text-gray-500">
        Every note written across every teacher and child, newest first — a cross-cutting view for spotting
        inconsistent note-taking or checking in on a specific child&apos;s progress. Showing the most recent 150.
      </p>

      {rows.length === 0 ? <p className="text-sm text-gray-500">No therapy notes written yet.</p> : <NotesList notes={rows} />}
    </main>
  )
}
