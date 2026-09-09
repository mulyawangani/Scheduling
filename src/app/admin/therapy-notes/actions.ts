'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'

/**
 * Sends a note back to its teacher with a required comment — the teacher
 * edits and resubmits (see resubmitTherapyNote), which returns it here for a
 * second look. owner_comment is left in place through that resubmit cycle so
 * this list can show what was asked for; it's cleared on accept.
 */
export async function sendNoteBack(noteId: string, comment: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }
  if (!comment.trim()) return { error: 'A comment is required when sending a note back.' }

  const { error } = await supabase
    .from('therapy_notes')
    .update({ status: 'sent_back', owner_comment: comment, updated_at: new Date().toISOString() })
    .eq('id', noteId)

  if (error) return { error: 'Could not send this note back.' }

  logAudit(supabase, user.id, 'send_note_back', 'therapy_note', noteId, { comment })

  revalidatePath('/admin/therapy-notes')
  revalidatePath('/teacher/therapy-notes')
  return { error: null }
}

/** Approves a note — only past this point can the parent app see it (see the parent RLS policy on therapy_notes). */
export async function acceptNote(noteId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { error } = await supabase
    .from('therapy_notes')
    .update({ status: 'accepted', owner_comment: null, updated_at: new Date().toISOString() })
    .eq('id', noteId)

  if (error) return { error: 'Could not accept this note.' }

  logAudit(supabase, user.id, 'accept_note', 'therapy_note', noteId)

  revalidatePath('/admin/therapy-notes')
  revalidatePath('/teacher/therapy-notes')
  return { error: null }
}
