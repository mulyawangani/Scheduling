import { createClient } from '@/lib/supabase/server'
import { NewStudentForm } from './new-student-form'

export default async function NewStudentPage() {
  const supabase = await createClient()
  const { data: subjects } = await supabase.from('subjects').select('*').order('name')

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-xl font-semibold">Add a student</h1>
      <NewStudentForm subjects={subjects ?? []} />
    </main>
  )
}
