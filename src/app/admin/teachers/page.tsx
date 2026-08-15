import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NewTeacherForm } from './new-teacher-form'

export default async function TeachersPage() {
  const supabase = await createClient()
  const { data: teachers } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('role', 'teacher')
    .order('name')

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Teachers</h1>
        <NewTeacherForm />
      </div>

      {!teachers || teachers.length === 0 ? (
        <p className="text-sm text-gray-500">No teachers yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {teachers.map((teacher) => (
            <li key={teacher.id} className="p-3">
              <Link href={`/admin/teachers/${teacher.id}`} className="font-medium hover:underline">
                {teacher.name}
              </Link>
              <p className="text-sm text-gray-500">{teacher.email}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
