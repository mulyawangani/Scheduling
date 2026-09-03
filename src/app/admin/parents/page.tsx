import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { ParentRow } from './parent-row'
import { requireOwner } from '@/lib/auth/require-owner'

export default async function ParentsPage() {
  await requireOwner()
  const supabase = await createClient()
  const { data: parents } = await supabase
    .from('profiles')
    .select('id, name, email, phone, priority_tier')
    .eq('role', 'parent')
    .order('name')

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-6 text-xl font-semibold">Parents</h1>
      {!parents || parents.length === 0 ? (
        <p className="text-sm text-gray-500">No parents yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {parents.map((parent) => (
            <ParentRow
              key={parent.id}
              id={parent.id}
              name={parent.name}
              email={parent.email}
              phone={parent.phone}
              priorityTier={parent.priority_tier}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
