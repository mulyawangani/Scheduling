'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { RecurrenceType } from '@/lib/supabase/types'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { computeMatchScore } from '@/lib/matching/suggest'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

interface AssignParams {
  studentId: string
  subjectId: string
  teacherId: string
  recurrenceType: RecurrenceType
  dayOfWeek?: number
  timeOfDayStart?: string
  timeOfDayEnd?: string
  startTime?: string
  endTime?: string
  source: 'algorithm' | 'manual'
  note?: string
}

async function createSessionPlan(params: AssignParams) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const matchScore = await computeMatchScore(supabase, params.teacherId, params.subjectId)

  const { data: plan, error } = await supabase
    .from('session_plans')
    .insert({
      student_id: params.studentId,
      subject_id: params.subjectId,
      teacher_id: params.teacherId,
      owner_id: user.id,
      recurrence_type: params.recurrenceType,
      day_of_week: params.recurrenceType === 'weekly' ? params.dayOfWeek : null,
      time_of_day_start: params.recurrenceType === 'weekly' ? params.timeOfDayStart : null,
      time_of_day_end: params.recurrenceType === 'weekly' ? params.timeOfDayEnd : null,
      start_time: params.recurrenceType === 'one_off' ? params.startTime : null,
      end_time: params.recurrenceType === 'one_off' ? params.endTime : null,
      source: params.source,
      match_score: matchScore,
      note: params.note || null,
    })
    .select('token')
    .single()

  if (error || !plan) return { error: `Could not create session: ${error?.message}` }

  const { data: details } = await supabase
    .from('students')
    .select('name, profiles!students_parent_id_fkey(name, phone)')
    .eq('id', params.studentId)
    .single()
  const { data: teacher } = await supabase.from('profiles').select('name').eq('id', params.teacherId).single()
  const { data: subject } = await supabase.from('subjects').select('name').eq('id', params.subjectId).single()

  const parent = Array.isArray(details?.profiles) ? details?.profiles[0] : details?.profiles
  const when =
    params.recurrenceType === 'one_off' && params.startTime
      ? dateFormatter.format(new Date(params.startTime))
      : `every ${DAYS[params.dayOfWeek ?? 0]} ${params.timeOfDayStart?.slice(0, 5)}`

  let whatsappError: string | null = null
  if (parent?.phone) {
    const link = `${process.env.NEXT_PUBLIC_SITE_URL}/offer/${plan.token}`
    const message = `Hi ${parent.name}, a session for ${details?.name} (${subject?.name} with ${teacher?.name}) is proposed for ${when}. Confirm here: ${link}`
    const result = await sendWhatsAppMessage(parent.phone, message)
    whatsappError = result.error
  } else {
    whatsappError = 'Parent has no phone number on file.'
  }

  revalidatePath('/admin/suggestions')
  return { error: null, whatsappError }
}

export async function approveSuggestion(
  studentId: string,
  subjectId: string,
  teacherId: string,
  dayOfWeek: number,
  timeOfDayStart: string,
  timeOfDayEnd: string
) {
  return createSessionPlan({
    studentId,
    subjectId,
    teacherId,
    recurrenceType: 'weekly',
    dayOfWeek,
    timeOfDayStart,
    timeOfDayEnd,
    source: 'algorithm',
  })
}

export async function manualAssign(studentId: string, subjectId: string, formData: FormData) {
  const teacherId = String(formData.get('teacherId') || '')
  const recurrenceType = String(formData.get('recurrenceType') || '') as RecurrenceType
  const note = String(formData.get('note') || '')

  if (!teacherId || !recurrenceType) {
    return { error: 'Teacher and recurrence type are required.' }
  }

  if (recurrenceType === 'weekly') {
    const day = formData.get('day')
    const timeStart = String(formData.get('timeOfDayStart') || '')
    const timeEnd = String(formData.get('timeOfDayEnd') || '')
    if (day === null || day === '' || !timeStart || !timeEnd) {
      return { error: 'Day, start time, and end time are required for a weekly session.' }
    }
    return createSessionPlan({
      studentId,
      subjectId,
      teacherId,
      recurrenceType: 'weekly',
      dayOfWeek: Number(day),
      timeOfDayStart: timeStart,
      timeOfDayEnd: timeEnd,
      source: 'manual',
      note,
    })
  }

  const startTime = String(formData.get('startTime') || '')
  const endTime = String(formData.get('endTime') || '')
  if (!startTime || !endTime) {
    return { error: 'Start and end time are required for a one-off session.' }
  }
  return createSessionPlan({
    studentId,
    subjectId,
    teacherId,
    recurrenceType: 'one_off',
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    source: 'manual',
    note,
  })
}
