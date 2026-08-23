import { createClient } from '@/lib/supabase/server'
import type { SubProtocol } from '@/lib/supabase/types'
import { BackLink } from '@/components/back-link'
import { ChildCard } from './child-card'
import { NewChildForm } from './new-child-form'

export default async function ChildrenPage() {
  const supabase = await createClient()

  const [{ data: students }, { data: protocols }, { data: subProtocols }, { data: parents }] = await Promise.all([
    supabase
      .from('students')
      .select(
        'id, name, date_of_birth, rate_per_session, priority, status, weekly_target_sessions, profiles!students_parent_id_fkey(name), student_protocols(protocol_id, sub_protocol_id)'
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
            return (
              <ChildCard
                key={student.id}
                studentId={student.id}
                name={student.name}
                parentName={parentName}
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
              />
            )
          })}
        </ul>
      )}
    </main>
  )
}
