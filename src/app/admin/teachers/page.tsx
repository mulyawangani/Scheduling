import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { NewTeacherForm } from './new-teacher-form'
import { TeacherRow } from './teacher-row'
import { requireOwner } from '@/lib/auth/require-owner'

export default async function TeachersPage() {
  await requireOwner()
  const supabase = await createClient()
  const { data: teachers } = await supabase
    .from('profiles')
    .select('id, name, email, status, serves_scope')
    .eq('role', 'teacher')
    .order('name')

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <BackLink href="/admin" label="Dashboard" />
        <h1 className="mb-4 text-xl font-semibold">Teachers</h1>
        <NewTeacherForm />
      </div>

      {!teachers || teachers.length === 0 ? (
        <p className="text-sm text-gray-500">No teachers yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {teachers.map((teacher) => (
            <TeacherRow
              key={teacher.id}
              id={teacher.id}
              name={teacher.name}
              email={teacher.email}
              status={teacher.status}
              servesScope={teacher.serves_scope}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
