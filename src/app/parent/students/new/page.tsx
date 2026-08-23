import { createClient } from '@/lib/supabase/server'
import type { SubProtocol } from '@/lib/supabase/types'
import { BackLink } from '@/components/back-link'
import { NewStudentForm } from './new-student-form'

export default async function NewStudentPage() {
  const supabase = await createClient()
  const [{ data: protocols }, { data: subProtocols }] = await Promise.all([
    supabase.from('protocols').select('*').eq('is_active', true).order('title'),
    supabase.from('sub_protocols').select('*').eq('is_active', true).order('title'),
  ])

  const subProtocolsByProtocol: Record<string, SubProtocol[]> = {}
  for (const sp of subProtocols ?? []) {
    ;(subProtocolsByProtocol[sp.protocol_id] ??= []).push(sp)
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <BackLink href="/parent" label="Home" />
      <h1 className="mb-6 text-xl font-semibold">Add a student</h1>
      <NewStudentForm protocols={protocols ?? []} subProtocolsByProtocol={subProtocolsByProtocol} />
    </main>
  )
}
