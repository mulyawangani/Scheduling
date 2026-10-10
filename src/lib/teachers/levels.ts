import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TeacherLevel } from '@/lib/supabase/types'

export type { TeacherLevel }

export const TEACHER_LEVELS: readonly TeacherLevel[] = ['senior', 'junior', 'intern']

export const TEACHER_LEVEL_LABEL: Record<TeacherLevel, string> = {
  senior: 'Senior teacher',
  junior: 'Junior teacher',
  intern: 'Intern',
}

export function isTeacherLevel(value: unknown): value is TeacherLevel {
  return typeof value === 'string' && (TEACHER_LEVELS as readonly string[]).includes(value)
}

/**
 * Each teacher's level (profiles.teacher_level, added by supabase/add_teacher_level.sql). `available`
 * is false until that column exists, so the Teachers page and the Owner dashboard keep working before
 * the SQL has been run.
 */
export async function loadTeacherLevels(
  supabase: SupabaseClient<Database>
): Promise<{ available: boolean; byId: Map<string, TeacherLevel | null> }> {
  const { data, error } = await supabase.from('profiles').select('id, teacher_level').eq('role', 'teacher')
  if (error) return { available: false, byId: new Map() }
  return {
    available: true,
    byId: new Map((data ?? []).map((row) => [row.id, isTeacherLevel(row.teacher_level) ? row.teacher_level : null])),
  }
}
