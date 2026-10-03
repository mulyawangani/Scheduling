/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireAdminOrOwner } from '@/lib/auth/require-admin-or-owner'

export async function createClassroom({
  name, ageGroup, primaryTeacherId, secondaryTeacherId,
}: {
  name: string
  ageGroup: string
  primaryTeacherId: string
  secondaryTeacherId: string
}) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { error } = await db.from('classrooms').insert({
    name: name.trim(),
    age_group: ageGroup.trim() || null,
    primary_teacher_id: primaryTeacherId || null,
    secondary_teacher_id: secondaryTeacherId || null,
  })

  if (error) throw new Error(error.message)
  redirect('/admin/classrooms')
}

export async function updateClassroom(
  id: string,
  data: { name: string; ageGroup: string; primaryTeacherId: string; secondaryTeacherId: string; active: boolean }
) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { error } = await db.from('classrooms').update({
    name: data.name.trim(),
    age_group: data.ageGroup.trim() || null,
    primary_teacher_id: data.primaryTeacherId || null,
    secondary_teacher_id: data.secondaryTeacherId || null,
    active: data.active,
  }).eq('id', id)

  if (error) throw new Error(error.message)
  redirect(`/admin/classrooms/${id}`)
}

export async function assignStudentToClassroom(studentId: string, classroomId: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { error } = await db.from('students').update({ classroom_id: classroomId }).eq('id', studentId)
  if (error) throw new Error(error.message)
  redirect(`/admin/classrooms/${classroomId}`)
}

export async function removeStudentFromClassroom(studentId: string, classroomId: string) {
  await requireAdminOrOwner()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { error } = await db.from('students').update({ classroom_id: null }).eq('id', studentId)
  if (error) throw new Error(error.message)
  redirect(`/admin/classrooms/${classroomId}`)
}
