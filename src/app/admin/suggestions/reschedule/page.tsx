import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { getRankedNeeds, isReopenedNeed } from '@/lib/matching/ranked-needs'
import { getUpcomingWeekStart } from '@/lib/week'
import { RecommendationList } from '../recommendation/recommendation-list'
import { SuggestionsNav } from '../suggestions-nav'

// Both 'owner' and the narrower 'admin' role can reach this page — it's
// deliberately the one piece of scheduling admin is allowed to touch: fixing
// a need that reopened because a booked session got cancelled or declined,
// not booking new schedules from scratch. See requireOwnerOrReschedulableNeed
// for the matching enforcement on the Assign page this links to.
export default async function ReschedulePage() {
  const supabase = await createClient()
  const withCandidates = await getRankedNeeds(supabase, getUpcomingWeekStart())
  const reopened = withCandidates
    .filter(isReopenedNeed)
    .sort((a, b) => (b.previousTeacher?.respondedAtISO ?? '').localeCompare(a.previousTeacher?.respondedAtISO ?? ''))

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Scheduling</h1>
      <SuggestionsNav active="/admin/suggestions/reschedule" />

      <p className="mb-4 text-sm text-gray-500">
        Needs that reopened because a booked session was cancelled or a teacher declined it — reschedule each one
        with a new teacher or time. Needs that were never booked in the first place aren&apos;t shown here; that&apos;s
        Simulations, not this page.
      </p>

      {reopened.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing to reschedule right now.</p>
      ) : (
        <RecommendationList items={reopened} showRank={false} />
      )}
    </main>
  )
}
