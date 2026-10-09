/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { requireCapability } from '@/lib/auth/require-capability'
import { NewActivityForm } from './new-activity-form'
import { ActivityRow } from './activity-row'

export const dynamic = 'force-dynamic'

type Activity = { id: string; name: string; is_active: boolean; monthly_price: number | null }

export default async function ExtracurricularPage() {
  await requireCapability('ops.extracurricular')
  const db = (await createClient()) as any

  const { data, error } = await db
    .from('extracurricular_activities')
    .select('id, name, is_active, monthly_price')
    .order('name')

  const activities = (data ?? []) as Activity[]
  const offered = activities.filter(a => a.is_active).length

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Extracurricular Activities</h1>
        <p className="mt-1 text-sm text-gray-500">
          Activities parents can sign their children up for, with the monthly price.
          {activities.length > 0 && ` ${offered} of ${activities.length} offered.`}
        </p>
      </div>

      <NewActivityForm />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load the activities: {error.message}
          {/monthly_price/.test(error.message) &&
            ' Run supabase/add_extracurricular_pricing.sql in the Supabase SQL editor first.'}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-gray-500">No activities yet. Add one above.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm">
          {activities.map(a => (
            <ActivityRow
              key={a.id}
              id={a.id}
              name={a.name}
              isActive={a.is_active}
              monthlyPrice={a.monthly_price === null ? null : Number(a.monthly_price)}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
