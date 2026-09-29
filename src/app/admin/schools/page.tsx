import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { requireOwner } from '@/lib/auth/require-owner'
import { SchoolsManager } from './schools-manager'

export default async function SchoolsPage() {
  await requireOwner()
  const supabase = await createClient()
  const { data: schools } = await supabase.from('schools').select('id, name').order('name')

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-6 text-xl font-semibold">Schools</h1>
      <SchoolsManager schools={schools ?? []} />
    </main>
  )
}
