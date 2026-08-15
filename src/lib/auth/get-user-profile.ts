import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'
import type { User } from '@supabase/supabase-js'

export async function getUserProfile(): Promise<{ user: User; profile: Profile } | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  if (!profile) return null

  return { user, profile }
}
