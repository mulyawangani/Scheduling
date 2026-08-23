'use server'

import { createClient } from '@/lib/supabase/server'
import { suggestTeachers, type SuggestionCandidate } from '@/lib/matching/suggest'

export interface ManualAssignData {
  studentName: string
  protocolName: string
  allTeachers: { id: string; name: string }[]
  candidates: SuggestionCandidate[]
}

/** Feeds the combined Manual Addition page — picking a child + protocol loads this inline instead of navigating to a separate assign page. */
export async function getManualAssignData(
  studentId: string,
  protocolId: string,
  weekStartDate: string
): Promise<ManualAssignData> {
  const supabase = await createClient()
  const [{ data: student }, { data: protocol }, { data: allTeachers }, candidates] = await Promise.all([
    supabase.from('students').select('name').eq('id', studentId).single(),
    supabase.from('protocols').select('title').eq('id', protocolId).single(),
    supabase.from('profiles').select('id, name').eq('role', 'teacher').order('name'),
    suggestTeachers(supabase, studentId, protocolId, weekStartDate),
  ])

  return {
    studentName: student?.name ?? 'Unknown student',
    protocolName: protocol?.title ?? 'Unknown protocol',
    allTeachers: allTeachers ?? [],
    candidates,
  }
}
