import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { StudentStatus } from '@/lib/supabase/types'
import { BackLink } from '@/components/back-link'
import { ChildCard } from './child-card'
import { NewChildForm } from './new-child-form'
import { requireAdminOrOwner } from '@/lib/auth/require-admin-or-owner'

const STATUS_LABELS: Record<string, string> = {
  none: 'None',
  trial: 'Trial',
  student: 'Student',
  non_student: 'Non-student',
  inactive: 'Inactive',
}

export default async function ChildrenPage({ searchParams }: { searchParams: Promise<{ student?: string; status?: string }> }) {
  await requireAdminOrOwner()
  const { student: highlightStudentId, status: statusFilter } = await searchParams
  const supabase = await createClient()

  let studentsQuery = supabase
    .from('students')
    .select(
      'id, name, date_of_birth, rate_per_session, priority, status, weekly_target_sessions, school_id, profiles!students_parent_id_fkey(name), schools(name), therapy_locations(name)'
    )
    .order('name')

  if (statusFilter === 'none') {
    studentsQuery = studentsQuery.is('status', null)
  } else if (statusFilter && STATUS_LABELS[statusFilter]) {
    studentsQuery = studentsQuery.eq('status', statusFilter as StudentStatus)
  }

  const [{ data: students }, { data: parents }, { data: schools }] = await Promise.all([
    studentsQuery,
    supabase.from('profiles').select('id, name').eq('role', 'parent').order('name'),
    supabase.from('schools').select('id, name').order('name'),
  ])

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
                autoExpand={student.id === highlightStudentId}
              />
            )
          })}
        </ul>
      )}
    </main>
  )
}
