/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { requireCapability } from '@/lib/auth/require-capability'
import { AnnouncementForm } from './announcement-form'

export const dynamic = 'force-dynamic'

export default async function NewAnnouncementPage() {
  await requireCapability('ops.announcements')
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: classrooms } = await db
    .from('classrooms')
    .select('id, name')
    .eq('active', true)
    .order('name')

  return (
    <main className="mx-auto max-w-xl p-6">
      <BackLink href="/admin/announcements" label="Announcements" />
      <h1 className="text-xl font-semibold mb-6">New Announcement</h1>
      <AnnouncementForm classrooms={classrooms ?? []} />
    </main>
  )
}
