'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireAdminOrOwner } from '@/lib/auth/require-admin-or-owner'

export async function createAnnouncement({
  title, body, targetType, targetClassroomId, status,
}: {
  title: string
  body: string
  targetType: 'ALL' | 'CLASSROOM'
  targetClassroomId: string
  status: 'DRAFT' | 'PUBLISHED'
}) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await db.from('announcements').insert({
    title: title.trim(),
    body: body.trim(),
    target_type: targetType,
    target_classroom_id: targetType === 'CLASSROOM' && targetClassroomId ? targetClassroomId : null,
    status,
    author_id: user.id,
    published_at: status === 'PUBLISHED' ? new Date().toISOString() : null,
  })

  if (error) throw new Error(error.message)
  redirect('/admin/announcements')
}
