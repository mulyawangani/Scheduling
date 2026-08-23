import { createClient } from '@/lib/supabase/server'
import { suggestTeachers } from '@/lib/matching/suggest'
import { BackLink } from '@/components/back-link'
import { AssignForm } from './assign-form'

export default async function SuggestionDetailPage({
  params,
}: {
  params: Promise<{ studentId: string; protocolId: string }>
}) {
  const { studentId, protocolId } = await params
  const supabase = await createClient()

  const [{ data: student }, { data: protocol }, { data: allTeachers }, candidates] = await Promise.all([
    supabase.from('students').select('name').eq('id', studentId).single(),
    supabase.from('protocols').select('title').eq('id', protocolId).single(),
    supabase.from('profiles').select('id, name').eq('role', 'teacher').order('name'),
    suggestTeachers(supabase, studentId, protocolId),
  ])

  return (
    <main className="mx-auto max-w-lg p-6">
      <BackLink href="/admin/suggestions" label="Suggestions" />
      <h1 className="mb-6 text-xl font-semibold">
        {student?.name} — {protocol?.title}
      </h1>
      <AssignForm
        studentId={studentId}
        protocolId={protocolId}
        candidates={candidates}
        allTeachers={allTeachers ?? []}
      />
    </main>
  )
}
