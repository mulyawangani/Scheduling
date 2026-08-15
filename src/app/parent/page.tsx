import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'

export default async function ParentDashboard() {
  const result = await getUserProfile()
  const supabase = await createClient()

  const { data: students } = await supabase
    .from('students')
    .select('id, name, student_subjects(subjects(name))')
    .eq('parent_id', result!.user.id)
    .order('created_at', { ascending: true })

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your students</h1>
        <Link
          href="/parent/students/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add student
        </Link>
      </div>

      {!students || students.length === 0 ? (
        <p className="text-sm text-gray-500">No students yet. Add one to get started.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {students.map((student) => {
            const subjectNames = (student.student_subjects ?? [])
              .map((ss) => (Array.isArray(ss.subjects) ? ss.subjects[0]?.name : ss.subjects?.name))
              .filter(Boolean)
            return (
              <li key={student.id} className="p-3">
                <Link href={`/parent/students/${student.id}`} className="font-medium hover:underline">
                  {student.name}
                </Link>
                <p className="text-sm text-gray-500">
                  {subjectNames.length > 0 ? subjectNames.join(', ') : 'No subjects set yet'}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
