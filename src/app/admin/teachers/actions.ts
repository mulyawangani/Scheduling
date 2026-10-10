'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { authorize } from '@/lib/auth/require-capability'
import { isTeacherLevel, type TeacherLevel } from '@/lib/teachers/levels'
import { revalidatePath } from 'next/cache'

// Server actions are web endpoints, so each one checks the caller against the
// permission table before it does anything. createTeacher and deleteTeacher
// use the master (service-role) key, which bypasses every database rule, so
// that check is the only protection they have.

export async function createTeacher(formData: FormData) {
  const auth = await authorize('people.teacher.add')
  if (!auth.ok) return { error: auth.error }

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

// `level` is left out (undefined) until the teacher_level column exists; '' clears it.
export async function updateTeacherProfile(teacherId: string, name: string, status: string, servesScope: string, level?: string) {
  const auth = await authorize('people.teacher.edit')
  if (!auth.ok) return { error: auth.error }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required.' }
  if (status !== 'teacher' && status !== 'therapist') return { error: 'Status must be teacher or therapist.' }
  if (servesScope !== '' && servesScope !== 'student_only' && servesScope !== 'non_student_only' && servesScope !== 'both') {
    return { error: 'Invalid serves scope.' }
  }
  let teacherLevel: TeacherLevel | null | undefined
  if (level === undefined) teacherLevel = undefined
  else if (level === '') teacherLevel = null
  else if (isTeacherLevel(level)) teacherLevel = level
  else return { error: 'Invalid level.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({
      name: trimmed,
      status,
      serves_scope: servesScope === '' ? null : servesScope,
      ...(teacherLevel === undefined ? {} : { teacher_level: teacherLevel }),
    })
    .eq('id', teacherId)
    .eq('role', 'teacher')
    .select('id')

  if (error) return { error: 'Could not update teacher.' }
  if (!data || data.length === 0) return { error: 'Not saved: your account is not allowed to change this teacher.' }

  revalidatePath('/admin/teachers')
  return { error: null }
}

// Toggled straight from the teachers list, no edit mode needed — flips
// whether this teacher's future notes need the owner's accept/send-back (see
// submitTherapyNote) or auto-publish straight to 'accepted'. Doesn't touch
// any note already written.
export async function setTeacherNoteReview(teacherId: string, requiresReview: boolean) {
  const auth = await authorize('people.teacher.noteReview')
  if (!auth.ok) return { error: auth.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ requires_note_review: requiresReview })
    .eq('id', teacherId)
    .eq('role', 'teacher')
    .select('id')

  if (error) return { error: 'Could not update this teacher.' }
  if (!data || data.length === 0) return { error: 'Not saved: your account is not allowed to change this teacher.' }

  revalidatePath('/admin/teachers')
  return { error: null }
}

// Deleting the auth user (not just the profiles row) cascades to profiles
// and every dependent row (availability, protocol assignments, sessions),
// same as how createTeacher creates the auth user first. Only teacher
// accounts can be removed here: the master key would otherwise delete any
// account (an owner or admin) given its id.
export async function deleteTeacher(teacherId: string) {
  const auth = await authorize('people.teacher.remove')
  if (!auth.ok) return { error: auth.error }

  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('role').eq('id', teacherId).maybeSingle()
  if (!target || target.role !== 'teacher') return { error: 'Only teacher accounts can be removed here.' }

  const { error } = await admin.auth.admin.deleteUser(teacherId)

  if (error) return { error: 'Could not delete teacher.' }

  revalidatePath('/admin/teachers')
  return { error: null }
}
