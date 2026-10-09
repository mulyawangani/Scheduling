import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { NewTeacherForm } from './new-teacher-form'
import { TeacherRow } from './teacher-row'
import { requireCapability } from '@/lib/auth/require-capability'
import { accessOf, can, canChange } from '@/lib/auth/permissions'

export default async function TeachersPage() {
  const { role } = await requireCapability('people.staff.view')
  const supabase = await createClient()
  const { data: teachers } = await supabase
    .from('profiles')
    .select('id, name, email, status, serves_scope, requires_note_review')
    .eq('role', 'teacher')
    .order('name')

  // What each control shows comes from the permission table, so a role never
  // sees a button the database would silently ignore.
  const canAdd = canChange(role, 'people.teacher.add')
  const canOpen = can(role, 'sched.teacherView')
  const canEdit = canChange(role, 'people.teacher.edit')
  const canRemove = canChange(role, 'people.teacher.remove')
  const reviewAccess = accessOf(role, 'people.teacher.noteReview')

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <BackLink href="/admin" label="Dashboard" />
        <h1 className="mb-4 text-xl font-semibold">Teachers</h1>
        {canAdd && <NewTeacherForm />}
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
              requiresNoteReview={teacher.requires_note_review}
              canOpen={canOpen}
              canEdit={canEdit}
              canRemove={canRemove}
              reviewAccess={reviewAccess}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
