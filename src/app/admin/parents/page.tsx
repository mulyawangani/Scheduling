import { createClient } from '@/lib/supabase/server'
import { PrioritySelect } from './priority-select'

export default async function ParentsPage() {
  const supabase = await createClient()
  const { data: parents } = await supabase
    .from('profiles')
    .select('id, name, email, priority_tier')
    .eq('role', 'parent')
    .order('name')

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Parents</h1>
      {!parents || parents.length === 0 ? (
        <p className="text-sm text-gray-500">No parents yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {parents.map((parent) => (
            <li key={parent.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">{parent.name}</p>
                <p className="text-sm text-gray-500">{parent.email}</p>
              </div>
              <PrioritySelect parentId={parent.id} tier={parent.priority_tier} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
