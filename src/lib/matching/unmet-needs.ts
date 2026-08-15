import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface UnmetNeed {
  studentId: string
  studentName: string
  subjectId: string
  subjectName: string
  parentPriorityTier: number
}

interface NeedRow {
  student_id: string
  subject_id: string
  students: { name: string; profiles: { priority_tier: number } | { priority_tier: number }[] | null } | null
  subjects: { name: string } | null
}

/**
 * A student_subjects row with no pending/accepted session_plans for that
 * (student, subject) pair — cancelling a session reopens the need with no
 * extra bookkeeping, since it just stops appearing in the "active" set.
 */
export async function getUnmetNeeds(
  supabase: SupabaseClient<Database>
): Promise<UnmetNeed[]> {
  const [{ data: needs }, { data: activePlans }] = await Promise.all([
    supabase
      .from('student_subjects')
      .select('student_id, subject_id, students(name, profiles!students_parent_id_fkey(priority_tier)), subjects(name)')
      .returns<NeedRow[]>(),
    supabase.from('session_plans').select('student_id, subject_id').in('status', ['pending', 'accepted']),
  ])

  const activeSet = new Set((activePlans ?? []).map((p) => `${p.student_id}:${p.subject_id}`))

  const unmet = (needs ?? [])
    .filter((n) => !activeSet.has(`${n.student_id}:${n.subject_id}`))
    .map((n) => {
      const profile = Array.isArray(n.students?.profiles) ? n.students?.profiles[0] : n.students?.profiles
      return {
        studentId: n.student_id,
        studentName: n.students?.name ?? 'Unknown student',
        subjectId: n.subject_id,
        subjectName: n.subjects?.name ?? 'Unknown subject',
        parentPriorityTier: profile?.priority_tier ?? 0,
      }
    })

  unmet.sort((a, b) => b.parentPriorityTier - a.parentPriorityTier)
  return unmet
}
