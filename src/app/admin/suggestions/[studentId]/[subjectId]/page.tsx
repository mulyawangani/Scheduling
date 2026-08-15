import { createClient } from '@/lib/supabase/server'
import { suggestTeachers } from '@/lib/matching/suggest'
import { AssignForm } from './assign-form'

export default async function SuggestionDetailPage({
  params,
}: {
  params: Promise<{ studentId: string; subjectId: string }>
}) {
  const { studentId, subjectId } = await params
  const supabase = await createClient()

  const [{ data: student }, { data: subject }, { data: allTeachers }, candidates] = await Promise.all([
    supabase.from('students').select('name').eq('id', studentId).single(),
    supabase.from('subjects').select('name').eq('id', subjectId).single(),
    supabase.from('profiles').select('id, name').eq('role', 'teacher').order('name'),
    suggestTeachers(supabase, studentId, subjectId),
  ])

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-xl font-semibold">
        {student?.name} — {subject?.name}
      </h1>
      <AssignForm
        studentId={studentId}
        subjectId={subjectId}
        candidates={candidates}
        allTeachers={allTeachers ?? []}
      />
    </main>
  )
}
