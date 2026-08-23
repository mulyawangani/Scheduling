'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createTeacher(formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const status = String(formData.get('status') || '')

  if (!name || !email || !password) {
    return { error: 'Name, email, and password are required.' }
  }
  if (status !== 'teacher' && status !== 'therapist') {
    return { error: 'Status must be teacher or therapist.' }
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
    status,
  })

  if (profileError) {
    return { error: 'Account created but profile setup failed.' }
  }

  revalidatePath('/admin/teachers')
  return { error: null }
}

export async function updateTeacherProfile(teacherId: string, name: string, status: string, servesScope: string) {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required.' }
  if (status !== 'teacher' && status !== 'therapist') return { error: 'Status must be teacher or therapist.' }
  if (servesScope !== '' && servesScope !== 'student_only' && servesScope !== 'non_student_only' && servesScope !== 'both') {
    return { error: 'Invalid serves scope.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ name: trimmed, status, serves_scope: servesScope === '' ? null : servesScope })
    .eq('id', teacherId)

  if (error) return { error: 'Could not update teacher.' }

  revalidatePath('/admin/teachers')
  return { error: null }
}

// Deleting the auth user (not just the profiles row) cascades to profiles
// and every dependent row (availability, protocol assignments, sessions),
// same as how createTeacher creates the auth user first.
export async function deleteTeacher(teacherId: string) {
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(teacherId)

  if (error) return { error: 'Could not delete teacher.' }

  revalidatePath('/admin/teachers')
  return { error: null }
}
