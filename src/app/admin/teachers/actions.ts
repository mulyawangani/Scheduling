'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createTeacher(formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  const email = String(formData.get('email') || '').trim()
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
    role: 'teacher',
    name,
    email,
  })

  if (profileError) {
    return { error: 'Account created but profile setup failed.' }
  }

  revalidatePath('/admin/teachers')
  return { error: null }
}
