/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireNanny } from '@/lib/auth/require-nanny'
import { CheckInBoard } from './check-in-board'

export const dynamic = 'force-dynamic'

const WIB_OFFSET = 7 * 60 * 60 * 1000

export default async function NannyCheckInPage() {
  await requireNanny()
  const db = (await createClient()) as any

  const todayStr = new Date(Date.now() + WIB_OFFSET).toISOString().slice(0, 10)

  const [{ data: classrooms }, { data: students }, { data: todayAttendance, error: attendanceError }] = await Promise.all([
    db.from('classrooms').select('id, name, age_group').eq('active', true).order('name'),
    db.from('students').select('id, name, classroom_id').eq('status', 'student').order('name'),
    db.from('attendance_records')
      .select('student_id, status, check_in_at, check_out_at, temperature, physical_note, absence_reason')
      .eq('date', todayStr),
  ])

  const attMap = new Map<string, any>()
  for (const rec of todayAttendance ?? []) attMap.set(rec.student_id, rec)

  const studentsByClassroom = new Map<string, any[]>()
  for (const s of students ?? []) {
    if (!s.classroom_id) continue
    if (!studentsByClassroom.has(s.classroom_id)) studentsByClassroom.set(s.classroom_id, [])
    studentsByClassroom.get(s.classroom_id)!.push(s)
  }

  const serialized = (classrooms ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    ageGroup: c.age_group ?? null,
    students: (studentsByClassroom.get(c.id) ?? []).map((s: any) => {
      const att = attMap.get(s.id) ?? null
      return {
        id: s.id,
        name: s.name,
        attendance: att ? {
          status: att.status,
          check_in_at: att.check_in_at ?? null,
          check_out_at: att.check_out_at ?? null,
          temperature: att.temperature ?? null,
          physical_note: att.physical_note ?? null,
          absence_reason: att.absence_reason ?? null,
        } : null,
      }
    }),
  }))

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ paddingTop: 4, paddingBottom: 28 }}>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Classroom</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Student Check-In</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Today&apos;s arrival status · {new Date(todayStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>
      {attendanceError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load today&apos;s attendance: {attendanceError.message}
          {/absence_reason/.test(attendanceError.message) &&
            ' Run supabase/add_absence_reason.sql in the Supabase SQL editor.'}
        </div>
      )}
      <CheckInBoard classrooms={serialized} />
    </div>
  )
}
