'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function signUpParent(formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  const email = String(formData.get('email') || '').trim()
  const phone = String(formData.get('phone') || '').trim()
  const password = String(formData.get('password') || '')

  if (!name || !email || !password) {
    return { error: 'Name, email, and password are required.' }
  }

  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data.user) {
    return { error: error?.message ?? 'Could not create account.' }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role: 'parent',
    name,
    email,
    phone: phone || null,
  })

  if (profileError) {
    return { error: 'Account created but profile setup failed. Contact support.' }
  }

  return { error: null }
}
