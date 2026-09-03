import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { getRankedNeeds, isReopenedNeed } from '@/lib/matching/ranked-needs'
import { getUpcomingWeekStart } from '@/lib/week'
import { RecommendationList } from './recommendation-list'
import { SuggestionsNav } from '../suggestions-nav'
import { requireOwner } from '@/lib/auth/require-owner'

export default async function RecommendationPage() {
  await requireOwner()
  const supabase = await createClient()

  const withCandidates = await getRankedNeeds(supabase, getUpcomingWeekStart())

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Scheduling</h1>
      <SuggestionsNav active="/admin/suggestions/recommendation" />

      <p className="mb-4 text-sm text-gray-500">
        Every currently-unscheduled need, in the order your Rules say to tackle them next — this list refreshes
        itself automatically as needs get booked or new ones appear, so whatever&apos;s unscheduled this week is
        exactly what shows up here for next week too. For each one, the best teacher match is shown even if she
        doesn&apos;t fully cover it or isn&apos;t free yet — a starting point for stretching capacity when supply is
        short, before you decide to accept a partial match or wait.
      </p>

      {(() => {
        const reopened = withCandidates
          .filter(isReopenedNeed)
          .sort((a, b) => (b.previousTeacher?.respondedAtISO ?? '').localeCompare(a.previousTeacher?.respondedAtISO ?? ''))
        if (reopened.length === 0) return null
        return (
          <section className="mb-8">
            <h2 className="mb-2 text-sm font-medium text-red-700">
              Cancelled or declined session{reopened.length === 1 ? '' : 's'} ({reopened.length})
            </h2>
            <p className="mb-3 text-xs text-gray-500">
              These needs just reopened because a booked session was cancelled or the teacher declined it — surfaced
              here first regardless of the normal Rules order below. Also handleable from the narrower{' '}
              <Link href="/admin/suggestions/reschedule" className="underline">
                Reschedule
              </Link>{' '}
              page, which is what the admin role uses for exactly this.
            </p>
            <RecommendationList items={reopened} showRank={false} />
          </section>
        )
      })()}

      {withCandidates.length === 0 ? (
        <p className="text-sm text-gray-500">No unmet needs right now.</p>
      ) : (
        <RecommendationList items={withCandidates} />
      )}

      {(() => {
        const prioritized = withCandidates.filter((item) => item.need.prioritized)
        if (prioritized.length === 0) return null
        return (
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-medium text-gray-700">Prioritized for next week ({prioritized.length})</h2>
            <p className="mb-3 text-xs text-gray-500">
              Flagged from the list above — Generate Schedule tries these before anything else, ahead of the normal
              Rules order, until they&apos;re booked or you un-prioritize them.
            </p>
            <RecommendationList items={prioritized} showRank={false} />
          </section>
        )
      })()}
    </main>
  )
}
