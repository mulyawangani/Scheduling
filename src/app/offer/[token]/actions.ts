'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function respondToOffer(token: string, response: 'accepted' | 'declined') {
  const supabase = createAdminClient()

  const { data: offer, error: fetchError } = await supabase
    .from('session_plans')
    .select('id, status')
    .eq('token', token)
    .single()

  if (fetchError || !offer) {
    return { error: 'Offer not found.' }
  }

  if (offer.status !== 'pending') {
    return { error: 'This offer has already been responded to.' }
  }

  const { error } = await supabase
    .from('session_plans')
    .update({ status: response, responded_at: new Date().toISOString() })
    .eq('token', token)
    .eq('status', 'pending')

  if (error) {
    return { error: 'Something went wrong. Please try again.' }
  }

  revalidatePath(`/offer/${token}`)
  return { error: null }
}
