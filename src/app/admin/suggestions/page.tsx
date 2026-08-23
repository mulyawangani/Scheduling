import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUnmetNeeds } from '@/lib/matching/unmet-needs'
import { generateSchedule } from '@/lib/matching/generate-schedule'
import { getWeekStart, getUpcomingWeekStart, formatWeekLabel } from '@/lib/week'
import { BackLink } from '@/components/back-link'
import { ScheduleGrid } from './schedule-grid'
import { UnassignedList } from './unassigned-list'
import { VersionsPanel, type ParsedScheduleVersion } from './versions-panel'
import { ResetAllButton } from './reset-all-button'
import { SuggestionsNav } from './suggestions-nav'
import { CollapsibleSection } from '@/components/collapsible-section'
import type { ProposedSession, UnscheduledNeed } from '@/lib/matching/generate-schedule'

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const supabase = await createClient()
  const weekStartDate = week ? getWeekStart(new Date(`${week}T00:00:00Z`)) : null
  const needs = await getUnmetNeeds(supabase, weekStartDate ?? getUpcomingWeekStart())

  const [{ count: activeSessionCount }, { count: prioritizedCount }] = await Promise.all([
    supabase.from('session_plans').select('id', { count: 'exact', head: true }).in('status', ['pending', 'accepted']),
    supabase.from('prioritized_needs').select('student_id', { count: 'exact', head: true }),
  ])
  const schedule = weekStartDate ? await generateSchedule(supabase, weekStartDate) : null

  // The grid above already computes an availability-aware placement for
  // every need it could fit this run — reuse that instead of a second,
  // separate lookup per row in the Unassigned sessions list below.
  const recommendedByNeed: Record<string, ProposedSession> = {}
  if (schedule) {
    for (const p of schedule.proposals) recommendedByNeed[`${p.studentId}:${p.protocolId}`] = p
  }

  const { data: versionRows } = weekStartDate
    ? await supabase
        .from('schedule_versions')
        .select('*')
        .eq('week_start_date', weekStartDate)
        .order('created_at', { ascending: false })
    : { data: null }

  const versions: ParsedScheduleVersion[] = (versionRows ?? []).map((v) => ({
    ...v,
    proposals: v.proposals as unknown as ProposedSession[],
    unscheduled: v.unscheduled as unknown as UnscheduledNeed[],
  }))

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Suggestions</h1>
      <SuggestionsNav active="/admin/suggestions" />

      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-gray-700">Generate schedule</h2>
          <ResetAllButton activeSessionCount={activeSessionCount ?? 0} prioritizedCount={prioritizedCount ?? 0} />
        </div>
        <p className="mb-3 text-sm text-gray-500">
          Pick any date in the target week — proposes a Mon–Fri schedule filling unmet needs into slots that fit
          every teacher&apos;s availability, quota, and protocol qualification. Nothing is booked until you commit a
          row below.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/admin/suggestions" method="GET" className="flex items-center gap-2">
            <input
              type="date"
              name="week"
              defaultValue={week ?? getUpcomingWeekStart()}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Generate schedule
            </button>
          </form>
          <Link
            href={`/admin/suggestions/manual?week=${weekStartDate ?? getUpcomingWeekStart()}`}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Manual addition
          </Link>
        </div>

        {schedule && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Week of {formatWeekLabel(schedule.weekStartDate)}</p>
              <Link href="/admin/suggestions" className="text-sm text-gray-500 hover:underline">
                Clear all
              </Link>
            </div>
            <ScheduleGrid schedule={schedule} />
          </div>
        )}
      </section>

      {weekStartDate && (
        <section className="mb-8">
          <CollapsibleSection title="Saved versions" defaultOpen={false}>
            <VersionsPanel
              versions={versions}
              weekStartDate={weekStartDate}
              existing={schedule?.existing ?? []}
              holidays={schedule?.holidays ?? []}
            />
          </CollapsibleSection>
        </section>
      )}

      <CollapsibleSection title={`Unassigned sessions${needs.length > 0 ? ` (${needs.length})` : ''}`} defaultOpen={false}>
        {needs.length === 0 ? (
          <p className="text-sm text-gray-500">No unmet needs right now.</p>
        ) : (
          <UnassignedList needs={needs} recommendedByNeed={schedule ? recommendedByNeed : undefined} />
        )}
      </CollapsibleSection>
    </main>
  )
}
