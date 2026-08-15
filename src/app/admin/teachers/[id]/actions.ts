'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function setCapability(teacherId: string, subjectId: string, rating: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const { error } = await supabase.from('teacher_capabilities').upsert(
    {
      teacher_id: teacherId,
      subject_id: subjectId,
      rating,
      rated_by: user.id,
      rated_at: new Date().toISOString(),
    },
    { onConflict: 'teacher_id,subject_id' }
  )

  if (error) return { error: 'Could not save rating.' }

  revalidatePath(`/admin/teachers/${teacherId}`)
  return { error: null }
}

export async function clearCapability(teacherId: string, subjectId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('teacher_capabilities')
    .delete()
    .eq('teacher_id', teacherId)
    .eq('subject_id', subjectId)

  if (error) return { error: 'Could not clear rating.' }

  revalidatePath(`/admin/teachers/${teacherId}`)
  return { error: null }
}
