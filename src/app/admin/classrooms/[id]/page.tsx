/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { requireCapability } from '@/lib/auth/require-capability'
import { notFound } from 'next/navigation'
import { ClassroomEditor } from './classroom-editor'
import { StudentRoster } from './student-roster'

export const dynamic = 'force-dynamic'

export default async function ClassroomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability('ops.classrooms')
  const { id } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [classroomResult, teachersResult, enrolledResult, unassignedResult] = await Promise.all([
    db.from('classrooms').select(`
      id, name, age_group, active,
      primary_teacher:profiles!classrooms_primary_teacher_id_fkey(id, name),
      secondary_teacher:profiles!classrooms_secondary_teacher_id_fkey(id, name)
    `).eq('id', id).single(),
    supabase.from('profiles').select('id, name').eq('role', 'teacher').order('name'),
    // An inactive child (for example a graduated student) shows nowhere in the classroom setting;
    // a child with no status still does.
    db.from('students').select('id, name, date_of_birth, status').eq('classroom_id', id).or('status.is.null,status.neq.inactive').order('name'),
    db.from('students').select('id, name, status').is('classroom_id', null).or('status.is.null,status.neq.inactive').order('name'),
  ])

  if (!classroomResult.data) notFound()

  const classroom = classroomResult.data
  const teachers: { id: string; name: string }[] = teachersResult.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrolled: any[] = enrolledResult.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unassigned: any[] = unassignedResult.data ?? []

  const primaryName = Array.isArray(classroom.primary_teacher)
    ? classroom.primary_teacher[0]?.name
    : classroom.primary_teacher?.name
  const secondaryName = Array.isArray(classroom.secondary_teacher)
    ? classroom.secondary_teacher[0]?.name
    : classroom.secondary_teacher?.name
  const primaryId = Array.isArray(classroom.primary_teacher)
    ? classroom.primary_teacher[0]?.id
    : classroom.primary_teacher?.id
  const secondaryId = Array.isArray(classroom.secondary_teacher)
    ? classroom.secondary_teacher[0]?.id
    : classroom.secondary_teacher?.id

  return (
    <main className="mx-auto max-w-2xl p-6 flex flex-col gap-8">
      <div>
        <BackLink href="/admin/classrooms" label="Classrooms" />
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-semibold">{classroom.name}</h1>
          {classroom.age_group && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
              {classroom.age_group}
            </span>
          )}
          {!classroom.active && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
              Inactive
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Lead: {primaryName ?? 'None'} · Asst: {secondaryName ?? 'None'}
        </p>
      </div>

      <ClassroomEditor
        id={id}
        name={classroom.name}
        ageGroup={classroom.age_group ?? ''}
        primaryTeacherId={primaryId ?? ''}
        secondaryTeacherId={secondaryId ?? ''}
        active={classroom.active}
        teachers={teachers}
      />

      <StudentRoster classroomId={id} enrolled={enrolled} unassigned={unassigned} />
    </main>
  )
}
