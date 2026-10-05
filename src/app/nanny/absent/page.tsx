/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireNanny } from '@/lib/auth/require-nanny'
import { BackLink } from '@/components/back-link'

export const dynamic = 'force-dynamic'

const WIB_OFFSET = 7 * 60 * 60 * 1000

const REASON_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  sick: { label: 'Sick', bg: '#FEF2F2', text: '#B91C1C' },
  vacation: { label: 'Vacation', bg: '#EFF6FF', text: '#1D4ED8' },
}
const NO_REASON = { label: 'No reason yet', bg: '#F3F4F6', text: '#6B7280' }
const REASON_ORDER: Record<string, number> = { sick: 0, vacation: 1 }

type Row = { studentId: string; name: string; classroom: string | null; reason: string | null }

export default async function AbsentPage() {
  await requireNanny()
  const db = (await createClient()) as any

  const todayStr = new Date(Date.now() + WIB_OFFSET).toISOString().slice(0, 10)

  const { data: records, error } = await db
    .from('attendance_records')
    .select(`
      student_id,
      absence_reason,
      students!attendance_records_student_id_fkey!inner(name, status, classrooms(name))
    `)
    .eq('date', todayStr)
    .eq('status', 'absent')
    .eq('students.status', 'student')

  const rows: Row[] = (records ?? []).map((r: any): Row => {
    const student = Array.isArray(r.students) ? r.students[0] : r.students
    const classroom = student?.classrooms
      ? (Array.isArray(student.classrooms) ? student.classrooms[0]?.name : student.classrooms?.name)
      : null
    return {
      studentId: r.student_id,
      name: student?.name ?? '—',
      classroom: classroom ?? null,
      reason: r.absence_reason ?? null,
    }
  })
  rows.sort(
    (a, b) =>
      (REASON_ORDER[a.reason ?? ''] ?? 2) - (REASON_ORDER[b.reason ?? ''] ?? 2) || a.name.localeCompare(b.name),
  )

  const sickCount = rows.filter(r => r.reason === 'sick').length
  const vacationCount = rows.filter(r => r.reason === 'vacation').length
  const noReasonCount = rows.length - sickCount - vacationCount

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <BackLink href="/nanny/dashboard" label="Dashboard" />
      <div style={{ paddingTop: 4, paddingBottom: 24 }}>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Today</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Absent</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date(todayStr + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          })} · {rows.length} absent
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load the absences: {error.message}
          {/absence_reason/.test(error.message) &&
            ' Run supabase/add_absence_reason.sql in the Supabase SQL editor.'}
        </div>
      )}

      {!error && rows.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: REASON_STYLE.sick.bg, color: REASON_STYLE.sick.text }}>
            Sick {sickCount}
          </span>
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: REASON_STYLE.vacation.bg, color: REASON_STYLE.vacation.text }}>
            Vacation {vacationCount}
          </span>
          {noReasonCount > 0 && (
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: NO_REASON.bg, color: NO_REASON.text }}>
              No reason yet {noReasonCount}
            </span>
          )}
        </div>
      )}

      {!error && rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          Nobody is marked absent today.
        </div>
      ) : (
        rows.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            {rows.map((r, i) => {
              const tag = (r.reason && REASON_STYLE[r.reason]) || NO_REASON
              return (
                <div
                  key={r.studentId}
                  className="flex items-center justify-between gap-3 px-5 py-4"
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-gray-900">{r.name}</p>
                    {r.classroom && <p className="text-xs text-gray-400 mt-0.5">{r.classroom}</p>}
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ background: tag.bg, color: tag.text }}
                  >
                    {tag.label}
                  </span>
                </div>
              )
            })}
          </div>
        )
      )}

      {!error && noReasonCount > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          {noReasonCount} without a reason. Pick one on the{' '}
          <Link href="/nanny/check-in" className="underline">Check-In</Link> page.
        </p>
      )}
    </div>
  )
}
