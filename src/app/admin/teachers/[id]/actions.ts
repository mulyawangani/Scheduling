'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function assignProtocol(teacherId: string, protocolId: string, subProtocolId: string | null, rating: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const { error } = await supabase.from('teacher_protocols').insert({
    teacher_id: teacherId,
    protocol_id: protocolId,
    sub_protocol_id: subProtocolId,
    rating,
    assigned_by: user.id,
  })

  if (error) return { error: 'Could not assign protocol.' }

  revalidatePath(`/admin/teachers/${teacherId}`)
  return { error: null }
}

export async function updateProtocolRating(teacherId: string, assignmentId: string, rating: number) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('teacher_protocols')
    .update({ rating })
    .eq('id', assignmentId)
    .eq('teacher_id', teacherId)

  if (error) return { error: 'Could not update rating.' }

  revalidatePath(`/admin/teachers/${teacherId}`)
  return { error: null }
}

export async function unassignProtocol(teacherId: string, assignmentId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('teacher_protocols').delete().eq('id', assignmentId).eq('teacher_id', teacherId)

  if (error) return { error: 'Could not unassign protocol.' }

  revalidatePath(`/admin/teachers/${teacherId}`)
  return { error: null }
}

// Cancels every pending/accepted session for this teacher — a full reset so
// her schedule can be regenerated from scratch. Same effect as cancelling
// each session individually (status -> cancelled), just in bulk.
export async function clearTeacherSchedule(teacherId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('session_plans')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('teacher_id', teacherId)
    .in('status', ['pending', 'accepted'])

  if (error) return { error: 'Could not clear schedule.' }

  revalidatePath(`/admin/teachers/${teacherId}`)
  return { error: null }
}
