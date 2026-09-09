import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

/**
 * Read-only — a teacher can see a child's protocol needs but never edit them
 * (that stays parent/owner territory, see student_protocols RLS). Access
 * itself is enforced by RLS's is_teacher_of_student: a student she's never
 * had a session for simply comes back null here, same as a bad id.
 */
export default async function TeacherStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: student }, { data: needs }] = await Promise.all([
    supabase.from('students').select('id, name, date_of_birth').eq('id', id).single(),
    supabase.from('student_protocols').select('protocol_id, protocols(title), sub_protocols(title)').eq('student_id', id),
  ])

  if (!student) notFound()

  const needRows = (needs ?? []).map((n) => {
    const protocol = Array.isArray(n.protocols) ? n.protocols[0] : n.protocols
    const subProtocol = Array.isArray(n.sub_protocols) ? n.sub_protocols[0] : n.sub_protocols
    return { protocolTitle: protocol?.title ?? 'Unknown protocol', subProtocolTitle: subProtocol?.title ?? null }
  })

  return (
    <main className="mx-auto max-w-lg p-6">
      <BackLink href="/teacher/students" label="Your students" />
      <h1 className="mb-1 text-xl font-semibold">{student.name}</h1>
      {student.date_of_birth && (
        <p className="mb-6 text-sm text-gray-500">Born {dateFormatter.format(new Date(`${student.date_of_birth}T00:00:00Z`))}</p>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Protocol needs</h2>
        {needRows.length === 0 ? (
          <p className="text-sm text-gray-500">No protocol needs set for this child yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
            {needRows.map((n, i) => (
              <li key={i} className="p-3 text-sm">
                <span className="font-medium">{n.protocolTitle}</span>
                {n.subProtocolTitle && <span className="text-gray-500"> — {n.subProtocolTitle}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
