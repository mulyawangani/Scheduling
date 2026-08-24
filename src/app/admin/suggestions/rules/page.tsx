import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { RulesEditor } from './rules-editor'
import { PrioritizedList, type PrioritizedItem } from './prioritized-list'
import { SuggestionsNav } from '../suggestions-nav'

export default async function RulesPage() {
  const supabase = await createClient()
  const [{ data: rules }, { data: prioritizedRows }, { data: teachers }, { data: teacherConcurrencyRules }, { data: protocols }] = await Promise.all([
    supabase.from('scheduling_rules').select('*').eq('id', true).single(),
    supabase.from('prioritized_needs').select('student_id, protocol_id, students(name), protocols(title)'),
    supabase.from('profiles').select('id, name').eq('role', 'teacher').order('name'),
    supabase.from('teacher_concurrency_rules').select('*').order('start_time'),
    supabase.from('protocols').select('id, title').order('title'),
  ])

  const prioritizedItems: PrioritizedItem[] = (prioritizedRows ?? []).map((row) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students
    const protocol = Array.isArray(row.protocols) ? row.protocols[0] : row.protocols
    return {
      studentId: row.student_id,
      protocolId: row.protocol_id,
      studentName: student?.name ?? 'Unknown student',
      protocolName: protocol?.title ?? 'Unknown protocol',
    }
  })

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Scheduling</h1>
      <SuggestionsNav active="/admin/suggestions/rules" />

      <PrioritizedList items={prioritizedItems} />

      {!rules ? (
        <p className="text-sm text-red-600">Scheduling rules row is missing — run the setup SQL for the scheduling_rules table.</p>
      ) : (
        <RulesEditor
          rules={rules}
          teachers={teachers ?? []}
          teacherConcurrencyRules={teacherConcurrencyRules ?? []}
          protocols={protocols ?? []}
        />
      )}
    </main>
  )
}
