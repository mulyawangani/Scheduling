'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ScheduleVersion } from '@/lib/supabase/types'
import type { ProposedSession, UnscheduledNeed, ExistingSessionForGrid, WeekHoliday } from '@/lib/matching/generate-schedule'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'
import { deleteScheduleVersion } from './versions-actions'
import { exportVersionPdf } from './export-version-pdf'

export interface ParsedScheduleVersion extends Omit<ScheduleVersion, 'proposals' | 'unscheduled'> {
  proposals: ProposedSession[]
  unscheduled: UnscheduledNeed[]
}

const versionDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: BUSINESS_TIMEZONE,
})

function needKey(studentName: string, protocolName: string) {
  return `${studentName}:${protocolName}`
}

export function VersionsPanel({
  versions,
  weekStartDate,
  existing,
  holidays,
}: {
  versions: ParsedScheduleVersion[]
  weekStartDate: string
  existing: ExistingSessionForGrid[]
  holidays: WeekHoliday[]
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function toggleSelect(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this version? This cannot be undone.')) return
    setError(null)
    startTransition(async () => {
      const result = await deleteScheduleVersion(id)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  const compareVersions = selected
    .map((id) => versions.find((v) => v.id === id))
    .filter((v): v is ParsedScheduleVersion => Boolean(v))

  const needLabels = new Map<string, string>()
  for (const v of compareVersions) {
    for (const p of v.proposals) needLabels.set(needKey(p.studentName, p.protocolName), `${p.studentName} — ${p.protocolName}`)
    for (const u of v.unscheduled) needLabels.set(needKey(u.studentName, u.protocolName), `${u.studentName} — ${u.protocolName}`)
  }

  function cellFor(v: ParsedScheduleVersion, key: string): string {
    const p = v.proposals.find((p) => needKey(p.studentName, p.protocolName) === key)
    if (p) return `${p.teacherName}, ${p.startTime.slice(0, 5)}–${p.endTime.slice(0, 5)}`
    const u = v.unscheduled.find((u) => needKey(u.studentName, u.protocolName) === key)
    if (u) return 'Not scheduled'
    return '—'
  }

  if (versions.length === 0) {
    return <p className="text-sm text-gray-500">No saved versions for this week yet.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">
        Currently {existing.length} sessions actually scheduled, live. Each saved version below recorded its own
        scheduled count at the moment it was saved. Select up to two versions to compare their proposed/unscheduled
        snapshots side by side.
      </p>
      <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggleSelect(v.id)} />
              <span className="font-medium">{v.label}</span>
              <span className="text-gray-500">
                {v.scheduled_count} scheduled, {v.proposals.length} proposed, {v.unscheduled.length} not scheduled ·{' '}
                {versionDateFormatter.format(new Date(v.created_at))}
              </span>
            </label>
            <div className="flex shrink-0 gap-3">
              <button
                onClick={() => exportVersionPdf(v, weekStartDate, existing, holidays)}
                className="text-sm text-blue-600 hover:underline"
              >
                PDF
              </button>
              <button
                onClick={() => handleDelete(v.id)}
                disabled={isPending}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {compareVersions.length === 2 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="p-2 font-medium text-gray-700">Need</th>
                {compareVersions.map((v) => (
                  <th key={v.id} className="p-2 font-medium text-gray-700">
                    {v.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Array.from(needLabels.entries()).map(([key, label]) => (
                <tr key={key}>
                  <td className="p-2">{label}</td>
                  {compareVersions.map((v) => (
                    <td key={v.id} className="p-2">
                      {cellFor(v, key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
