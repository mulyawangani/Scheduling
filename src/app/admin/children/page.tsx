import { createClient } from '@/lib/supabase/server'
import type { SubProtocol } from '@/lib/supabase/types'
import { BackLink } from '@/components/back-link'
import { ChildCard } from './child-card'
import { NewChildForm } from './new-child-form'

export default async function ChildrenPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { student: highlightStudentId } = await searchParams
  const supabase = await createClient()

  const [{ data: students }, { data: protocols }, { data: subProtocols }, { data: parents }] = await Promise.all([
    supabase
      .from('students')
      .select(
        'id, name, date_of_birth, rate_per_session, priority, status, weekly_target_sessions, profiles!students_parent_id_fkey(name), schools(name), therapy_locations(name), student_protocols(protocol_id, sub_protocol_id)'
      )
      .order('name'),
    supabase.from('protocols').select('*').eq('is_active', true).order('title'),
    supabase.from('sub_protocols').select('*').eq('is_active', true).order('title'),
    supabase.from('profiles').select('id, name').eq('role', 'parent').order('name'),
  ])

  const subProtocolsByProtocol: Record<string, SubProtocol[]> = {}
  for (const sp of subProtocols ?? []) {
    ;(subProtocolsByProtocol[sp.protocol_id] ??= []).push(sp)
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-6 text-xl font-semibold">Children</h1>

      <NewChildForm parents={parents ?? []} />

      {!students || students.length === 0 ? (
        <p className="text-sm text-gray-500">No children yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {students.map((student) => {
            const parentName = Array.isArray(student.profiles) ? student.profiles[0]?.name : student.profiles?.name
            const schoolName = Array.isArray(student.schools) ? student.schools[0]?.name : student.schools?.name
            const therapyLocationName = Array.isArray(student.therapy_locations)
              ? student.therapy_locations[0]?.name
              : student.therapy_locations?.name
            // A protocol-level row (sub_protocol_id null) for a protocol that
            // actually has sub-protocols means the specific sub-protocol was
            // never recorded (or, for the 2026-08-27 data-loss incident, was
            // lost and reconstructed at the protocol level only) — flag it so
            // it doesn't sit unnoticed next to the deliberately-general rows
            // for protocols with no sub-protocols at all.
            const needsSubProtocolReview = student.student_protocols.some(
              (s) => s.sub_protocol_id === null && (subProtocolsByProtocol[s.protocol_id]?.length ?? 0) > 0
            )
            return (
              <ChildCard
                key={student.id}
                studentId={student.id}
                name={student.name}
                parentName={parentName}
                schoolName={schoolName}
                therapyLocationName={therapyLocationName}
                dateOfBirth={student.date_of_birth}
                ratePerSession={student.rate_per_session}
                priority={student.priority}
                status={student.status}
                weeklyTargetSessions={student.weekly_target_sessions}
                protocols={protocols ?? []}
                subProtocolsByProtocol={subProtocolsByProtocol}
                selectedNeeds={student.student_protocols.map((s) => ({
                  protocolId: s.protocol_id,
                  subProtocolId: s.sub_protocol_id,
                }))}
                autoExpand={student.id === highlightStudentId}
                needsSubProtocolReview={needsSubProtocolReview}
              />
            )
          })}
        </ul>
      )}
    </main>
  )
}
