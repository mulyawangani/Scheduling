'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function ownerToggleSubject(studentId: string, subjectId: string, enabled: boolean) {
  const supabase = await createClient()

  if (enabled) {
    const { error } = await supabase
      .from('student_subjects')
      .insert({ student_id: studentId, subject_id: subjectId })
    if (error) return { error: 'Could not add subject.' }
  } else {
    const { error } = await supabase
      .from('student_subjects')
      .delete()
      .eq('student_id', studentId)
      .eq('subject_id', subjectId)
    if (error) return { error: 'Could not remove subject.' }
  }

  revalidatePath('/admin/students')
  return { error: null }
}
