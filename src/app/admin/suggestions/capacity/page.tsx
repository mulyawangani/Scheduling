import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { CapacityList } from './capacity-list'
import { SuggestionsNav } from '../suggestions-nav'
import { requireOwner } from '@/lib/auth/require-owner'

export default async function CapacityPage() {
  await requireOwner()
  const supabase = await createClient()
  const { data: rules } = await supabase.from('capacity_rules').select('*').order('start_time')

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Scheduling</h1>
      <SuggestionsNav active="/admin/suggestions/capacity" />

      <p className="mb-4 text-sm text-gray-500">
        Center-wide caps on concurrent sessions during specific time bands, every day — counts everyone, therapists
        included, unlike the teacher-only cap under Rules → Provider constraints. Approving or assigning a session
        that would exceed a band&apos;s cap is blocked.
      </p>

      <CapacityList rules={rules ?? []} />
    </main>
  )
}
