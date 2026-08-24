import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { QuotaRow } from './quota-row'
import { SuggestionsNav } from '../suggestions-nav'

export default async function QuotaPage() {
  const supabase = await createClient()

  const { data: teachers } = await supabase
    .from('profiles')
    .select('id, name, weekly_quota, daily_quota, commission_per_session')
    .eq('role', 'teacher')
    .order('name')

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Suggestions</h1>
      <SuggestionsNav active="/admin/suggestions/quota" />

      <p className="mb-4 text-sm text-gray-500">
        Maximum sessions each teacher can take, set by you — independent of her uploaded availability. Commission per
        session is the flat amount she earns for each delivered session, shown on her own Commissions tab.
      </p>

      {!teachers || teachers.length === 0 ? (
        <p className="text-sm text-gray-500">No teachers yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="p-3 font-medium text-gray-700">Teacher</th>
                <th className="p-3 font-medium text-gray-700">Weekly quota</th>
                <th className="p-3 font-medium text-gray-700">Daily quota</th>
                <th className="p-3 font-medium text-gray-700">Commission/session</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {teachers.map((teacher) => (
                <QuotaRow
                  key={teacher.id}
                  id={teacher.id}
                  name={teacher.name}
                  weeklyQuota={teacher.weekly_quota}
                  dailyQuota={teacher.daily_quota}
                  commissionPerSession={teacher.commission_per_session}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
