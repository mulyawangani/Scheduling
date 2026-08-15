import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CapabilityEditor } from './capability-editor'

export default async function TeacherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: teacher }, { data: subjects }, { data: capabilities }] = await Promise.all([
    supabase.from('profiles').select('id, name, email').eq('id', id).eq('role', 'teacher').single(),
    supabase.from('subjects').select('*').order('name'),
    supabase.from('teacher_capabilities').select('subject_id, rating').eq('teacher_id', id),
  ])

  if (!teacher) {
    notFound()
  }

  const ratings = Object.fromEntries((capabilities ?? []).map((c) => [c.subject_id, c.rating]))

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-1 text-xl font-semibold">{teacher.name}</h1>
      <p className="mb-6 text-sm text-gray-500">{teacher.email}</p>
      <h2 className="mb-2 text-sm font-medium text-gray-700">Subject capability (1-5)</h2>
      <CapabilityEditor teacherId={id} subjects={subjects ?? []} ratings={ratings} />
    </main>
  )
}
