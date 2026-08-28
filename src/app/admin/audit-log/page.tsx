import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: BUSINESS_TIMEZONE,
})

const ACTION_LABELS: Record<string, string> = {
  book_all: 'Book all',
  create_schedule: 'Create schedule',
  push_whatsapp_batch: 'WhatsApp push',
  delete_schedule_batch: 'Delete schedule',
  cancel_schedule_batch: 'Cancel schedule',
  reset_all_schedules: 'Reset all schedules',
  decline_session: 'Decline session',
  cancel_monthly_transactions: 'Cancel monthly transactions',
  clear_needs: 'Clear need(s)',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function formatMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return null
  const entries = Object.entries(metadata as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined)
  const parts: string[] = []
  for (const [k, v] of entries) {
    if (Array.isArray(v)) {
      // A raw id list (e.g. session ids) is bookkeeping for whoever needs to
      // trace a specific row — the accompanying count already says how many,
      // so skip it here. A list of human-readable labels (e.g. which
      // student/protocol pairs a "Clear needs" cleared) is the whole point of
      // logging the action, so show it in full — this is the only record of
      // exactly what was removed, since needs have no soft-delete.
      if (v.length === 0 || (typeof v[0] === 'string' && UUID_RE.test(v[0]))) continue
      parts.push(`${k}: ${v.join('; ')}`)
    } else {
      parts.push(`${k}: ${v}`)
    }
  }
  return parts.length === 0 ? null : parts.join(' · ')
}

export default async function AuditLogPage() {
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('audit_log')
    .select('id, action, target_type, target_id, metadata, created_at, profiles(name)')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <h1 className="mb-1 text-xl font-semibold">Audit log</h1>
      <p className="mb-4 text-sm text-gray-500">
        A record of bulk actions — booking, scheduling, and WhatsApp pushes — for tracing back what happened and
        when. Showing the most recent 200.
      </p>

      {!rows || rows.length === 0 ? (
        <p className="text-sm text-gray-500">No actions logged yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {rows.map((row) => {
            const actor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
            const metaText = formatMetadata(row.metadata)
            return (
              <li key={row.id} className="p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{ACTION_LABELS[row.action] ?? row.action}</span>
                  <span className="shrink-0 text-xs text-gray-400">{dateFormatter.format(new Date(row.created_at))}</span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {actor?.name ?? 'Unknown'}
                  {row.target_type && row.target_id ? ` · ${row.target_type}: ${row.target_id}` : ''}
                </p>
                {metaText && <p className="mt-1 text-xs text-gray-600">{metaText}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
