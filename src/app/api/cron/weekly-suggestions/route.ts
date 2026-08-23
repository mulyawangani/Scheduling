import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUnmetNeeds } from '@/lib/matching/unmet-needs'
import { getUpcomingWeekStart } from '@/lib/week'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

/**
 * Runs every Friday (see vercel.json) to nudge the owner about next week's
 * unscheduled needs. It only notifies — it never creates or auto-approves
 * session_plans, so "suggest, owner approves" still holds. Matching stays
 * live in /admin/suggestions rather than a stale Friday snapshot.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const needs = await getUnmetNeeds(supabase, getUpcomingWeekStart())

  if (needs.length === 0) {
    return NextResponse.json({ notified: 0, unmetNeeds: 0 })
  }

  const { data: owners } = await supabase.from('profiles').select('phone').eq('role', 'owner')

  const message = `${needs.length} session${needs.length === 1 ? '' : 's'} need scheduling for next week. Review at ${process.env.NEXT_PUBLIC_SITE_URL}/admin/suggestions`

  let notified = 0
  for (const owner of owners ?? []) {
    if (!owner.phone) continue
    const result = await sendWhatsAppMessage(owner.phone, message)
    if (!result.error) notified++
  }

  return NextResponse.json({ notified, unmetNeeds: needs.length })
}
