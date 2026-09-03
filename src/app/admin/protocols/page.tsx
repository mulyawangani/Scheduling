import { createClient } from '@/lib/supabase/server'
import type { SubProtocol } from '@/lib/supabase/types'
import { BackLink } from '@/components/back-link'
import { ProtocolLibrary } from './protocol-library'
import { requireOwner } from '@/lib/auth/require-owner'

export default async function ProtocolsPage() {
  await requireOwner()
  const supabase = await createClient()

  const [{ data: protocols }, { data: subProtocols }] = await Promise.all([
    supabase.from('protocols').select('*').order('title'),
    supabase.from('sub_protocols').select('*').order('title'),
  ])

  const subProtocolsByProtocol: Record<string, SubProtocol[]> = {}
  for (const sp of subProtocols ?? []) {
    ;(subProtocolsByProtocol[sp.protocol_id] ??= []).push(sp)
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Protocols</h1>
      <p className="mb-6 text-sm text-gray-500">
        The library of protocols and sub-protocols. Assign specific ones to a teacher, with a rating, from her
        profile page.
      </p>
      <ProtocolLibrary protocols={protocols ?? []} subProtocolsByProtocol={subProtocolsByProtocol} />
    </main>
  )
}
