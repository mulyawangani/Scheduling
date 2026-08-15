import { createClient } from '@/lib/supabase/server'
import { NeedsEditor } from './needs-editor'

export default async function StudentsPage() {
  const supabase = await createClient()

  const [{ data: students }, { data: subjects }] = await Promise.all([
    supabase
      .from('students')
      .select('id, name, profiles!students_parent_id_fkey(name), student_subjects(subject_id)')
      .order('name'),
    supabase.from('subjects').select('*').order('name'),
  ])

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Students</h1>
      {!students || students.length === 0 ? (
        <p className="text-sm text-gray-500">No students yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {students.map((student) => {
            const parentName = Array.isArray(student.profiles) ? student.profiles[0]?.name : student.profiles?.name
            return (
              <li key={student.id} className="p-3">
                <p className="font-medium">{student.name}</p>
                <p className="mb-2 text-sm text-gray-500">Parent: {parentName}</p>
                <NeedsEditor
                  studentId={student.id}
                  subjects={subjects ?? []}
                  selectedSubjectIds={student.student_subjects.map((s) => s.subject_id)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
