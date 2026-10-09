import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { StudentStatus, SubProtocol } from '@/lib/supabase/types'
import { BackLink } from '@/components/back-link'
import { ChildCard, type ChildCardAccess } from './child-card'
import { NewChildForm } from './new-child-form'
import { requireCapability } from '@/lib/auth/require-capability'
import { accessOf, can, canChange } from '@/lib/auth/permissions'

const STATUS_LABELS: Record<string, string> = {
  none: 'None',
  trial: 'Trial',
  student: 'Student',
  non_student: 'Non-student',
  inactive: 'Inactive',
}

export default async function ChildrenPage({ searchParams }: { searchParams: Promise<{ student?: string; status?: string }> }) {
  const { role } = await requireCapability('students.view')
  const { student: highlightStudentId, status: statusFilter } = await searchParams
  const supabase = await createClient()

  // What each control shows comes from the permission table; the server
  // actions check the same table before they change anything.
  const access: ChildCardAccess = {
    edit: canChange(role, 'students.edit'),
    status: canChange(role, 'students.status'),
    billing: can(role, 'students.billing'),
    delete: canChange(role, 'students.delete'),
    needs: accessOf(role, 'students.needs'),
  }
  const canAdd = canChange(role, 'students.add')

  let studentsQuery = supabase
    .from('students')
    .select(
      'id, name, date_of_birth, rate_per_session, priority, status, weekly_target_sessions, school_id, profiles!students_parent_id_fkey(name), schools(name), therapy_locations(name), student_protocols(protocol_id, sub_protocol_id)'
    )
    .order('name')

  if (statusFilter === 'none') {
    studentsQuery = studentsQuery.is('status', null)
  } else if (statusFilter && STATUS_LABELS[statusFilter]) {
    studentsQuery = studentsQuery.eq('status', statusFilter as StudentStatus)
  }

  const [{ data: students }, { data: protocols }, { data: subProtocols }, { data: parents }, { data: schools }] = await Promise.all([
    studentsQuery,
    access.needs === 'no' ? Promise.resolve({ data: [] }) : supabase.from('protocols').select('*').eq('is_active', true).order('title'),
    access.needs === 'no' ? Promise.resolve({ data: [] }) : supabase.from('sub_protocols').select('*').eq('is_active', true).order('title'),
    canAdd ? supabase.from('profiles').select('id, name').eq('role', 'parent').order('name') : Promise.resolve({ data: [] }),
    supabase.from('schools').select('id, name').order('name'),
  ])

  const subProtocolsByProtocol: Record<string, SubProtocol[]> = {}
  for (const sp of (subProtocols ?? []) as SubProtocol[]) {
    ;(subProtocolsByProtocol[sp.protocol_id] ??= []).push(sp)
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold">Children</h1>
        {statusFilter && STATUS_LABELS[statusFilter] && (
          <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {STATUS_LABELS[statusFilter]}
            <Link href="/admin/children" className="ml-1 text-gray-400 hover:text-gray-700">✕</Link>
          </span>
        )}
      </div>

      {canAdd && <NewChildForm parents={(parents ?? []) as { id: string; name: string }[]} />}

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
            return (
              <ChildCard
                key={student.id}
                studentId={student.id}
                name={student.name}
                parentName={parentName}
                schoolId={student.school_id ?? null}
                schoolName={schoolName}
                therapyLocationName={therapyLocationName}
                dateOfBirth={student.date_of_birth}
                ratePerSession={student.rate_per_session}
                priority={student.priority}
                status={student.status}
                weeklyTargetSessions={student.weekly_target_sessions}
                schools={schools ?? []}
                access={access}
                protocols={(protocols ?? []) as import('@/lib/supabase/types').Protocol[]}
                subProtocolsByProtocol={subProtocolsByProtocol}
                selectedNeeds={student.student_protocols.map((s) => ({
                  protocolId: s.protocol_id,
                  subProtocolId: s.sub_protocol_id,
                }))}
                autoExpand={student.id === highlightStudentId}
              />
            )
          })}
        </ul>
      )}
    </main>
  )
}
