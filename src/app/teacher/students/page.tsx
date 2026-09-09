import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { BackLink } from '@/components/back-link'

/**
 * Every child this teacher has ever had a session for (any status) — same
 * set is_teacher_of_student grants her read access to, just deduped for a
 * list instead of checked per-row.
 */
export default async function TeacherStudentsPage() {
  const result = await getUserProfile()
  const supabase = await createClient()
  const teacherId = result!.user.id

  const { data: sessions } = await supabase.from('session_plans').select('student_id, students(id, name)').eq('teacher_id', teacherId)

  const studentsById = new Map<string, string>()
  for (const s of sessions ?? []) {
    const student = Array.isArray(s.students) ? s.students[0] : s.students
    if (student) studentsById.set(student.id, student.name)
  }
  const students = Array.from(studentsById, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <div>
        <BackLink href="/teacher" label="Your sessions" />
        <h1 className="mb-1 text-xl font-semibold">Your students</h1>
        <p className="text-sm text-gray-500">Open a child to see her protocol needs before her next session.</p>
      </div>

      {students.length === 0 ? (
        <p className="text-sm text-gray-500">No students yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {students.map((s) => (
            <li key={s.id}>
              <Link href={`/teacher/students/${s.id}`} className="block p-3 text-sm font-medium hover:bg-gray-50">
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
