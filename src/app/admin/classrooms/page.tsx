/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { requireCapability } from '@/lib/auth/require-capability'
import Link from 'next/link'
import { NewClassroomForm } from './new-classroom-form'

export const dynamic = 'force-dynamic'

const STATUS_TAG: Record<string, string> = {
  trial: 'Trial',
  non_student: 'Non-student',
  inactive: 'Inactive',
  none: 'No status',
}

export default async function ClassroomsPage() {
  await requireCapability('ops.classrooms')
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [classroomsResult, teachersResult] = await Promise.all([
    db.from('classrooms').select(`
      id, name, age_group, active,
      primary_teacher:profiles!classrooms_primary_teacher_id_fkey(id, name),
      secondary_teacher:profiles!classrooms_secondary_teacher_id_fkey(id, name)
    `).order('name'),
    supabase.from('profiles').select('id, name').eq('role', 'teacher').order('name'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classrooms: any[] = classroomsResult.data ?? []
  const teachers: { id: string; name: string }[] = teachersResult.data ?? []

  const studentsByClassroom: Record<string, { id: string; name: string; status: string | null }[]> = {}
  if (classrooms.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = classrooms.map((c: any) => c.id)
    const { data: students } = await db
      .from('students')
      .select('id, name, status, classroom_id')
      .in('classroom_id', ids)
      // An inactive child (for example a graduated student) shows nowhere in the classroom setting.
      .neq('status', 'inactive')
      .order('name')
    for (const s of students ?? []) {
      if (!studentsByClassroom[s.classroom_id]) studentsByClassroom[s.classroom_id] = []
      studentsByClassroom[s.classroom_id].push(s)
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Classrooms</h1>
        <NewClassroomForm teachers={teachers} />
      </div>

      {classrooms.length === 0 ? (
        <p className="text-sm text-gray-500">No classrooms yet. Create one above.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {classrooms.map((c: any) => {
            const primaryName = Array.isArray(c.primary_teacher) ? c.primary_teacher[0]?.name : c.primary_teacher?.name
            const secondaryName = Array.isArray(c.secondary_teacher) ? c.secondary_teacher[0]?.name : c.secondary_teacher?.name
            const roster = studentsByClassroom[c.id] ?? []
            const count = roster.length
            return (
              <li key={c.id} className="flex items-start justify-between px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                    {c.age_group && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                        {c.age_group}
                      </span>
                    )}
                    {!c.active && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {primaryName ? `Lead: ${primaryName}` : 'No lead teacher'}
                    {secondaryName ? ` · Asst: ${secondaryName}` : ''}
                    {' · '}
                    <span className="font-medium text-gray-500">{count} student{count !== 1 ? 's' : ''}</span>
                  </div>
                  {roster.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {roster.map(s => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 rounded-full border border-gray-100 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-700"
                        >
                          {s.name}
                          {s.status !== 'student' && (
                            <span className="text-[10px] text-gray-400">· {STATUS_TAG[s.status ?? 'none']}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Link
                  href={`/admin/classrooms/${c.id}`}
                  className="mt-0.5 text-xs font-semibold text-orange-500 hover:text-orange-600 flex-shrink-0"
                >
                  Manage →
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
