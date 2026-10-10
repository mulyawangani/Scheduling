/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { dateStringInBusinessTz } from '@/lib/timezone'
import { loadTeacherLevels } from '@/lib/teachers/levels'
import { loadBillingSummary } from '@/lib/dashboard/billing-summary'
import {
  countEnrolledStudents,
  sessionsPerChildInMonth,
  summarizeChildren,
  summarizeSchools,
  summarizeStaff,
  type ChildRow,
  type ChildSummary,
  type ExtracurricularExpected,
  type SchoolRow,
  type StaffSummary,
  type TherapyBilling,
} from '@/lib/dashboard/owner-stats'
import { NeedsAttention } from './needs-attention'
import { HomeShortcuts } from './home-shortcuts'
import { BillingBox } from './billing-box'
import { Box, Hint, Tile } from './dashboard-parts'

export interface OwnerDashboardData {
  monthLabel: string
  kids: ChildSummary
  /** Enrolled students, therapy clients and therapy sessions, one row per school. */
  schools: SchoolRow[]
  /** Montessori students already enrolled for each of the next two months. */
  enrolledAhead: { label: string; count: number }[]
  staff: StaffSummary
  /** False until the teacher_level column exists. */
  levelsAvailable: boolean
  therapy: TherapyBilling
  extra: ExtracurricularExpected
}

/** Reads everything the Owner's home shows. The therapy detail (schedule coverage, children with nothing booked) is on the Therapy overview. */
export async function loadOwnerDashboard(): Promise<OwnerDashboardData> {
  const supabase = await createClient()
  const db = supabase as any

  const thisMonth = dateStringInBusinessTz(new Date()).slice(0, 7)
  const [year, mon] = thisMonth.split('-').map(Number)
  // The two months after this one, as the first of the month (enrollments are one row per child per month).
  const monthsAhead = [1, 2].map((n) => {
    const d = new Date(Date.UTC(year, mon - 1 + n, 1))
    return d.toISOString().slice(0, 10)
  })

  const [{ data: children }, { data: schools }, aheadRes, staffRes, levels, billing] = await Promise.all([
    fetchAllRows<ChildRow>((from, to) => db.from('students').select('id, status, therapy_on, classroom_id, school_id').order('id').range(from, to)),
    supabase.from('schools').select('id, name').order('name'),
    db.from('enrollments').select('student_id, month').in('month', monthsAhead).eq('status', 'active'),
    supabase.from('profiles').select('id, role').in('role', ['teacher', 'principal']),
    loadTeacherLevels(supabase),
    loadBillingSummary(supabase),
  ])

  // A child set to Inactive does not say whether they were a student: look for a past enrollment. A child with
  // therapy switched off is an inactive client only if sessions were booked for them before. Read in small
  // groups of ids to keep each request short.
  const inactiveIds = (children ?? []).filter((c) => c.status === 'inactive').map((c) => c.id)
  const therapyOffIds = (children ?? []).filter((c) => !c.therapy_on).map((c) => c.id)
  const everEnrolled = new Set<string>()
  const hadTherapy = new Set<string>()
  for (let i = 0; i < inactiveIds.length; i += 100) {
    const { data } = await db.from('enrollments').select('student_id').in('student_id', inactiveIds.slice(i, i + 100))
    for (const r of (data ?? []) as { student_id: string }[]) everEnrolled.add(r.student_id)
  }
  for (let i = 0; i < therapyOffIds.length; i += 100) {
    const { data } = await db
      .from('session_plans')
      .select('student_id')
      .in('student_id', therapyOffIds.slice(i, i + 100))
      .in('status', ['pending', 'accepted', 'completed'])
    for (const r of (data ?? []) as { student_id: string }[]) hadTherapy.add(r.student_id)
  }

  // Per school, and how many students are already enrolled for the coming months
  const studentIds = new Set((children ?? []).filter((c) => c.status === 'student').map((c) => c.id))
  const aheadRows = (aheadRes.data ?? []) as { student_id: string; month: string }[]
  const enrolledAhead = monthsAhead.map((m) => ({
    label: new Date(`${m}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }),
    count: countEnrolledStudents(aheadRows.filter((r) => String(r.month).slice(0, 10) === m), studentIds),
  }))

  return {
    monthLabel: billing.monthLabel,
    kids: summarizeChildren(children ?? [], billing.enrolledThisMonth, everEnrolled, hadTherapy),
    schools: summarizeSchools(schools ?? [], children ?? [], billing.enrolledThisMonth, sessionsPerChildInMonth(billing.sessions, billing.month)),
    enrolledAhead,
    staff: summarizeStaff(staffRes.data ?? [], levels.byId),
    levelsAvailable: levels.available,
    therapy: billing.therapy,
    extra: billing.extra,
  }
}

export async function OwnerDashboard() {
  return <OwnerDashboardView data={await loadOwnerDashboard()} />
}

const GREEN = '#10B981'
const GREY = '#9CA3AF'

/** The Owner's home: four groups of numbers for the whole school. */
export function OwnerDashboardView({ data }: { data: OwnerDashboardData }) {
  const { monthLabel, kids, schools, enrolledAhead, staff, levelsAvailable, therapy, extra } = data

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Owner dashboard</h1>

      <NeedsAttention role="owner" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Box title="Students and therapy clients" href="/admin/children" linkLabel="Students">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Montessori students</p>
            <div className="grid grid-cols-2 gap-2">
              <Tile value={kids.students.active} label="Active (enrolled this month)" tone={GREEN} />
              <Tile value={kids.students.inactive} label="Inactive" tone={GREY} />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Therapy clients</p>
            <div className="grid grid-cols-2 gap-2">
              <Tile value={kids.therapyClients.active} label="Active (therapy on)" tone={GREEN} />
              <Tile value={kids.therapyClients.inactive} label="Inactive (therapy off)" tone={GREY} />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">By school</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    <th className="pb-1 pr-2 font-semibold">School</th>
                    <th className="pb-1 pr-2 text-right font-semibold">Enrolled</th>
                    <th className="pb-1 pr-2 text-right font-semibold">Therapy clients</th>
                    <th className="pb-1 text-right font-semibold">Therapy sessions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schools.map((s) => (
                    <tr key={s.name}>
                      <td className="py-1.5 pr-2 font-medium text-gray-700">{s.name}</td>
                      <td className="py-1.5 pr-2 text-right font-semibold text-gray-900">{s.enrolled}</td>
                      <td className="py-1.5 pr-2 text-right font-semibold text-gray-900">{s.therapyClients}</td>
                      <td className="py-1.5 text-right font-semibold text-gray-900">{s.therapySessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Hint>
            Enrolled: students enrolled this month. Therapy sessions: on the calendar in {monthLabel}. Already enrolled ahead:{' '}
            {enrolledAhead.map((a) => `${a.label} ${a.count}`).join(' · ')}.
          </Hint>
          <Hint>
            School status and therapy are two separate settings, so a child can be both a student and a therapy client. Inactive students:{' '}
            {kids.students.notEnrolled} not enrolled this month and {kids.students.inactive - kids.students.notEnrolled} set to Inactive (a graduated
            student must be). Inactive therapy clients: therapy switched off after sessions were booked.
          </Hint>
          <Hint>
            Other children: {kids.trial} on trial, {kids.nonStudents} non-students{kids.noStatus > 0 ? `, ${kids.noStatus} with no status` : ''}
            {kids.inactiveNotStudent > 0 ? `, ${kids.inactiveNotStudent} set to Inactive who were never students` : ''}. {kids.total} children in all.
          </Hint>
        </Box>

        <Box title="Teachers" href="/admin/teachers" linkLabel="Teachers">
          <div className="grid grid-cols-2 gap-2">
            <Tile value={staff.principals} label="Principal" />
            <Tile value={levelsAvailable ? staff.senior : '—'} label="Senior teacher" />
            <Tile value={levelsAvailable ? staff.junior : '—'} label="Junior teacher" />
            <Tile value={levelsAvailable ? staff.intern : '—'} label="Intern" />
          </div>
          {levelsAvailable ? (
            staff.notSet > 0 ? (
              <Hint>
                {staff.notSet} of {staff.teachers} teachers have no level yet. Set it with Edit on the Teachers page.
              </Hint>
            ) : (
              <Hint>{staff.teachers} teachers, every one with a level.</Hint>
            )
          ) : (
            <Hint>Teacher levels are not set up yet. Once they are, set each teacher&apos;s level with Edit on the Teachers page.</Hint>
          )}
        </Box>

        <BillingBox monthLabel={monthLabel} therapy={therapy} extra={extra} wide />

        <Box title="Montessori library and assessments" wide>
          <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center">
            <p className="text-sm font-medium text-gray-500">Not connected yet</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              Materials, activities and cards for each school, and the activities assessed per student by year, live in the Library and
              Montessori apps. They show here once those apps join this one.
            </p>
          </div>
        </Box>
      </div>

      <HomeShortcuts role="owner" />
    </main>
  )
}
