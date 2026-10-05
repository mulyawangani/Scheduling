/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireNanny } from '@/lib/auth/require-nanny'
import { BackLink } from '@/components/back-link'

export const dynamic = 'force-dynamic'

const WIB_OFFSET = 7 * 60 * 60 * 1000

function fmtTime(utcStr: string): string {
  const wib = new Date(new Date(utcStr).getTime() + WIB_OFFSET)
  return `${String(wib.getUTCHours()).padStart(2, '0')}:${String(wib.getUTCMinutes()).padStart(2, '0')}`
}

export default async function CheckedInPage() {
  await requireNanny()
  const db = (await createClient()) as any

  const todayStr = new Date(Date.now() + WIB_OFFSET).toISOString().slice(0, 10)

  const { data: records } = await db
    .from('attendance_records')
    .select(`
      student_id,
      status,
      check_in_at,
      check_out_at,
      temperature,
      physical_note,
      students!attendance_records_student_id_fkey(name, classrooms(name))
    `)
    .eq('date', todayStr)
    .eq('status', 'present')
    .order('check_in_at', { ascending: true })

  const rows = (records ?? []).map((r: any) => {
    const student = Array.isArray(r.students) ? r.students[0] : r.students
    const classroom = student?.classrooms
      ? (Array.isArray(student.classrooms) ? student.classrooms[0]?.name : student.classrooms?.name)
      : null
    return {
      studentId: r.student_id,
      name: student?.name ?? '—',
      classroom,
      checkInAt: r.check_in_at,
      checkOutAt: r.check_out_at,
      temperature: r.temperature,
      physicalNote: r.physical_note,
    }
  })

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <BackLink href="/nanny/dashboard" label="Dashboard" />
      <div style={{ paddingTop: 4, paddingBottom: 24 }}>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Today</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Students Checked In</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date(todayStr + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          })} · {rows.length} present
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          No students checked in yet today.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {rows.map((r: typeof rows[0], i: number) => (
            <div
              key={r.studentId}
              className="px-5 py-4"
              style={{ borderBottom: i < rows.length - 1 ? '1px solid #F3F4F6' : 'none' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{r.name}</p>
                  {r.classroom && (
                    <p className="text-xs text-gray-400 mt-0.5">{r.classroom}</p>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-gray-700">
                    In {r.checkInAt ? fmtTime(r.checkInAt) : '—'}
                    {r.checkOutAt && (
                      <span className="text-gray-400"> · Out {fmtTime(r.checkOutAt)}</span>
                    )}
                  </p>
                  {r.temperature != null && (
                    <p className="text-xs text-blue-600 mt-0.5">{r.temperature}°C</p>
                  )}
                </div>
              </div>

              {r.physicalNote && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                  📋 {r.physicalNote}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
