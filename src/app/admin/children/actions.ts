'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { Database, StudentStatus } from '@/lib/supabase/types'
import { logAudit } from '@/lib/audit'
import { authorize } from '@/lib/auth/require-capability'
import { canChange } from '@/lib/auth/permissions'

const SCHOOL_HOURS_WEEKDAYS = [1, 2, 3, 4, 5]
const SCHOOL_HOURS_START = '08:00:00'
const SCHOOL_HOURS_END = '12:00:00'

export async function ownerToggleProtocol(
  studentId: string,
  protocolId: string,
  subProtocolId: string | null,
  enabled: boolean
) {
  const auth = await authorize('students.needs')
  if (!auth.ok) return { error: auth.error }

  const supabase = await createClient()
  const user = auth.user

  if (enabled) {
    const { error } = await supabase
      .from('student_protocols')
      .insert({ student_id: studentId, protocol_id: protocolId, sub_protocol_id: subProtocolId })
    if (error) return { error: 'Could not add protocol.' }

    if (user) logAudit(supabase, user.id, 'add_protocol_need', 'student_protocols', undefined, await needLabel(supabase, studentId, protocolId, subProtocolId))

    // Checking a specific sub-protocol supersedes an earlier protocol-level
    // placeholder for the same protocol (e.g. one left over from the
    // 2026-08-27 data-loss recovery, which could only restore Reflex
    // Repatterning at the protocol level) — clear it so it doesn't linger as
    // an invisible duplicate need alongside the now-specific one.
    if (subProtocolId) {
      await supabase.from('student_protocols').delete().eq('student_id', studentId).eq('protocol_id', protocolId).is('sub_protocol_id', null)
    }
  } else {
    const label = await needLabel(supabase, studentId, protocolId, subProtocolId)
    let query = supabase.from('student_protocols').delete().eq('student_id', studentId).eq('protocol_id', protocolId)
    query = subProtocolId ? query.eq('sub_protocol_id', subProtocolId) : query.is('sub_protocol_id', null)
    const { error } = await query
    if (error) return { error: 'Could not remove protocol.' }

    if (user) logAudit(supabase, user.id, 'remove_protocol_need', 'student_protocols', undefined, label)
  }

  revalidatePath('/admin/children')
  return { error: null }
}

async function needLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  protocolId: string,
  subProtocolId: string | null
) {
  const [{ data: student }, { data: protocol }, { data: subProtocol }] = await Promise.all([
    supabase.from('students').select('name').eq('id', studentId).single(),
    supabase.from('protocols').select('title').eq('id', protocolId).single(),
    subProtocolId ? supabase.from('sub_protocols').select('title').eq('id', subProtocolId).single() : Promise.resolve({ data: null }),
  ])
  return {
    label: `${student?.name ?? studentId} — ${protocol?.title ?? protocolId}${subProtocol?.title ? ` (${subProtocol.title})` : ''}`,
  }
}

export async function updateChildProfile(studentId: string, formData: FormData) {
  const auth = await authorize('students.edit')
  if (!auth.ok) return { error: auth.error }

  const supabase = await createClient()

  // A role without the right to change status or the billing group
  // (rate, priority, weekly target) does not send those fields, so the server
  // decides from the permission table, not from what the form contains.
  const mayChangeStatus = canChange(auth.role, 'students.status')
  const mayChangeBilling = canChange(auth.role, 'students.billing')
  const mayChangeTherapy = canChange(auth.role, 'students.therapy')

  const name = String(formData.get('name') || '').trim()
  const dateOfBirth = String(formData.get('dateOfBirth') || '')
  const ratePerSession = String(formData.get('ratePerSession') || '')
  const priority = String(formData.get('priority') || '')
  const status = String(formData.get('status') || '') as StudentStatus | ''
  const weeklyTargetSessions = String(formData.get('weeklyTargetSessions') || '')
  const schoolId = String(formData.get('schoolId') || '') || null

  if (!name) return { error: 'Name is required.' }
  if (mayChangeBilling && weeklyTargetSessions !== '1' && weeklyTargetSessions !== '2' && weeklyTargetSessions !== '3') {
    return { error: 'Weekly target sessions must be 1, 2, or 3.' }
  }

  const changes: Database['public']['Tables']['students']['Update'] = {
    name,
    date_of_birth: dateOfBirth || null,
    school_id: schoolId,
  }
  if (mayChangeStatus) changes.status = status || null
  // Therapy is its own switch, separate from the school status: any status can be on or off.
  const therapyChoice = formData.get('therapyOn')
  const therapyOn = therapyChoice === 'on' ? true : therapyChoice === 'off' ? false : null
  if (mayChangeTherapy && therapyOn !== null) changes.therapy_on = therapyOn
  if (mayChangeBilling) {
    changes.rate_per_session = ratePerSession ? Number(ratePerSession) : null
    changes.priority = priority ? Number(priority) : null
    changes.weekly_target_sessions = Number(weeklyTargetSessions)
  }

  const { data: updated, error } = await supabase.from('students').update(changes).eq('id', studentId).select('id')

  if (error) return { error: 'Could not update profile.' }
  if (!updated || updated.length === 0) return { error: 'Not saved: your account is not allowed to edit this child.' }

  if (changes.therapy_on !== undefined && auth.user) {
    logAudit(supabase, auth.user.id, changes.therapy_on ? 'turn_therapy_on' : 'turn_therapy_off', 'students', studentId, { label: name })
  }

  if (mayChangeStatus && status === 'student') {
    await supabase.from('student_availability').delete().eq('student_id', studentId)
    const { error: availError } = await supabase.from('student_availability').insert(
      SCHOOL_HOURS_WEEKDAYS.map((day_of_week) => ({
        student_id: studentId,
        day_of_week,
        start_time: SCHOOL_HOURS_START,
        end_time: SCHOOL_HOURS_END,
      }))
    )
    if (availError) return { error: 'Profile saved, but could not set school-hours availability.' }
  }

  revalidatePath('/admin/children')
  return { error: null }
}

// Adds a child on a parent's behalf. The database only lets the Owner and the
// parent insert a child, so this uses the master key after the permission
// check, which is how Admin can do it too.
export async function createChild(formData: FormData) {
  const auth = await authorize('students.add')
  if (!auth.ok) return { error: auth.error }

  const parentId = String(formData.get('parentId') || '')
  const name = String(formData.get('name') || '').trim()

  if (!parentId || !name) return { error: 'Parent and name are required.' }

  const admin = createAdminClient()
  const { data: parent } = await admin.from('profiles').select('role').eq('id', parentId).maybeSingle()
  if (!parent || parent.role !== 'parent') return { error: 'Choose a parent account.' }

  const { error } = await admin.from('students').insert({ parent_id: parentId, name })

  if (error) return { error: 'Could not add child.' }

  revalidatePath('/admin/children')
  return { error: null }
}

export async function deleteChild(studentId: string) {
  const auth = await authorize('students.delete')
  if (!auth.ok) return { error: auth.error }

  const supabase = await createClient()

  const { data: deleted, error } = await supabase.from('students').delete().eq('id', studentId).select('id')

  if (error) return { error: 'Could not delete child.' }
  if (!deleted || deleted.length === 0) return { error: 'Not deleted: your account is not allowed to delete this child.' }

  revalidatePath('/admin/children')
  return { error: null }
}
