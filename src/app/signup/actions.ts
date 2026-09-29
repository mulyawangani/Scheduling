'use server'

import { createClient } from '@/lib/supabase/server'

export async function createParentProfile(data: { name: string; phone: string; email: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expired.' }

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    role: 'parent',
    name: data.name,
    email: data.email,
    phone: data.phone || null,
  })

  if (error) return { error: error.message }
  return { error: null }
}
