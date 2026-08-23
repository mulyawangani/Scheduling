'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RankFactor, SortDirection, SchedulingRules, TeacherConcurrencyRule } from '@/lib/supabase/types'
import { updateSchedulingRules } from './actions'
import { TeacherConcurrencyList } from './teacher-concurrency-list'

const FACTOR_LABEL: Record<RankFactor, string> = {
  priority: 'Student priority',
  rate: 'Session rate',
  protocol_needs: 'Sub-protocols needed',
  match_quality: 'Teacher match coverage',
  teacher_rating: 'Teacher capability rating',
}

const DIRECTION_LABEL: Record<RankFactor, Record<SortDirection, string>> = {
  // priority is stored as 1=High/2=Medium/3=Low (see src/lib/priority.ts), so
  // "first" is the low end of the number line, not the high end.
  priority: { asc: 'High priority first', desc: 'Low priority first' },
  rate: { desc: 'Higher rate first', asc: 'Lower rate first' },
  protocol_needs: { desc: 'More sub-protocols needed first', asc: 'Fewer sub-protocols needed first' },
  match_quality: { desc: 'Best-covered needs first', asc: 'Least-covered needs first' },
  teacher_rating: { desc: 'Highest-rated available teacher first', asc: 'Lowest-rated available teacher first' },
}

export function RulesEditor({
  rules,
  teachers,
  teacherConcurrencyRules,
  protocols,
}: {
  rules: SchedulingRules
  teachers: { id: string; name: string }[]
  teacherConcurrencyRules: TeacherConcurrencyRule[]
  protocols: { id: string; title: string }[]
}) {
  const [order, setOrder] = useState<RankFactor[]>(rules.rank_order)
  const [directions, setDirections] = useState<Record<RankFactor, SortDirection>>({
    priority: rules.priority_direction,
    rate: rules.rate_direction,
    protocol_needs: rules.protocol_needs_direction,
    match_quality: rules.match_quality_direction,
    teacher_rating: rules.teacher_rating_direction,
  })
  const [enabled, setEnabled] = useState<Record<RankFactor, boolean>>({
    priority: rules.priority_enabled,
    rate: rules.rate_enabled,
    protocol_needs: rules.protocol_needs_enabled,
    match_quality: rules.match_quality_enabled,
    teacher_rating: rules.teacher_rating_enabled,
  })
  const [matchQualityThreshold, setMatchQualityThreshold] = useState(rules.match_quality_threshold)
  const [weeklyMinimumSessions, setWeeklyMinimumSessions] = useState(rules.weekly_minimum_sessions)
  const [maxWeeklySpread, setMaxWeeklySpread] = useState(rules.max_weekly_spread)
  const [noBackToBackEnabled, setNoBackToBackEnabled] = useState(rules.no_back_to_back_enabled)
  const [noBackToBackTeacherEnabled, setNoBackToBackTeacherEnabled] = useState(rules.no_back_to_back_teacher_enabled)
  const [monthlyCheckinTeacherId, setMonthlyCheckinTeacherId] = useState(rules.monthly_checkin_teacher_id ?? '')
  const [prioritizedTeacherId, setPrioritizedTeacherId] = useState(rules.prioritized_teacher_id ?? '')
  const [prioritizedProtocolId, setPrioritizedProtocolId] = useState(rules.prioritized_protocol_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= order.length) return
    const next = [...order]
    ;[next[index], next[target]] = [next[target], next[index]]
    setOrder(next)
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    const formData = new FormData()
    for (const factor of order) formData.append('rank_order', factor)
    formData.set('priority_direction', directions.priority)
    formData.set('rate_direction', directions.rate)
    formData.set('protocol_needs_direction', directions.protocol_needs)
    formData.set('match_quality_direction', directions.match_quality)
    formData.set('teacher_rating_direction', directions.teacher_rating)
    formData.set('priority_enabled', String(enabled.priority))
    formData.set('rate_enabled', String(enabled.rate))
    formData.set('protocol_needs_enabled', String(enabled.protocol_needs))
    formData.set('match_quality_enabled', String(enabled.match_quality))
    formData.set('teacher_rating_enabled', String(enabled.teacher_rating))
    formData.set('match_quality_threshold', String(matchQualityThreshold))
    formData.set('weekly_minimum_sessions', String(weeklyMinimumSessions))
    formData.set('max_weekly_spread', String(maxWeeklySpread))
    formData.set('no_back_to_back_enabled', String(noBackToBackEnabled))
    formData.set('no_back_to_back_teacher_enabled', String(noBackToBackTeacherEnabled))
    formData.set('monthly_checkin_teacher_id', monthlyCheckinTeacherId)
    formData.set('prioritized_teacher_id', prioritizedTeacherId)
    formData.set('prioritized_protocol_id', prioritizedProtocolId)

    startTransition(async () => {
      const result = await updateSchedulingRules(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-1 text-sm font-medium text-gray-700">Matching order</h2>
        <p className="mb-3 text-sm text-gray-500">
          When there aren&apos;t enough slots for everyone, unmet needs are attempted in this order. Reorder with the
          arrows; each factor&apos;s tiebreak direction is set on the right. Uncheck a factor to skip it entirely —
          it won&apos;t even break ties, as if it wasn&apos;t in the list. &quot;Sub-protocols needed&quot; is just a
          count of how many sub-protocols the need itself has — it says nothing about whether a teacher can actually
          deliver it. &quot;Teacher match coverage&quot; and &quot;Teacher capability rating&quot; are what reflect
          real matching: the best available teacher&apos;s coverage of this specific child&apos;s sub-protocols, and
          her rating for them.
        </p>
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {order.map((factor, i) => (
            <li key={factor} className={`flex items-center gap-3 p-3 ${enabled[factor] ? '' : 'opacity-50'}`}>
              <span className="w-5 shrink-0 text-sm font-semibold text-gray-400">{i + 1}</span>
              <label className="flex flex-1 items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={enabled[factor]}
                  onChange={(e) => {
                    setEnabled((prev) => ({ ...prev, [factor]: e.target.checked }))
                    setSaved(false)
                  }}
                />
                {FACTOR_LABEL[factor]}
              </label>
              <select
                value={directions[factor]}
                disabled={!enabled[factor]}
                onChange={(e) => {
                  setDirections((prev) => ({ ...prev, [factor]: e.target.value as SortDirection }))
                  setSaved(false)
                }}
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
              >
                <option value="desc">{DIRECTION_LABEL[factor].desc}</option>
                <option value="asc">{DIRECTION_LABEL[factor].asc}</option>
              </select>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label="Move down"
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
        <label className="mt-3 flex max-w-sm flex-col gap-1 text-sm text-gray-700">
          Match quality threshold — coverage counts as a full match at or above
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={matchQualityThreshold}
              onChange={(e) => {
                setMatchQualityThreshold(Number(e.target.value))
                setSaved(false)
              }}
              className="flex-1"
            />
            <span className="w-12 shrink-0 text-right font-medium tabular-nums">{matchQualityThreshold}%</span>
          </div>
          <span className="text-xs text-gray-500">
            A teacher covering this much of a child&apos;s needed sub-protocols scores as a perfect (100%) match under
            &quot;Teacher match coverage&quot; above, same as a protocol with no sub-items. Lower it to let a
            partially-covering teacher compete fairly against simpler protocols; 100% means only exact full coverage
            counts.
          </span>
        </label>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-gray-700">Prioritize a teacher</h2>
        <p className="mb-3 text-sm text-gray-500">
          Puts this teacher first in line for every need she&apos;s qualified for — ahead of the matching order
          above and the monthly check-in teacher below. Use this to temporarily catch up a teacher who&apos;s
          fallen behind on workload; turn it off once she&apos;s caught up so ratings and load balance take over
          again.
        </p>
        <label className="flex max-w-xs flex-col gap-1 text-sm text-gray-700">
          Teacher
          <select
            value={prioritizedTeacherId}
            onChange={(e) => {
              setPrioritizedTeacherId(e.target.value)
              setSaved(false)
            }}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">— None —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-gray-700">Prioritize a protocol</h2>
        <p className="mb-3 text-sm text-gray-500">
          For a student whose weekly session target is more than 1, her unmet protocols compete for those few
          distinct-protocol slots each week. This protocol wins that competition over her other needs — useful when
          one protocol matters more right now (e.g. it&apos;s been going unscheduled for weeks). Set to &quot;—
          None —&quot; to let the normal matching order above decide instead.
        </p>
        <label className="flex max-w-xs flex-col gap-1 text-sm text-gray-700">
          Protocol
          <select
            value={prioritizedProtocolId}
            onChange={(e) => {
              setPrioritizedProtocolId(e.target.value)
              setSaved(false)
            }}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">— None —</option>
            {protocols.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-gray-700">Provider constraints</h2>
        <p className="mb-3 text-sm text-gray-500">
          Everyone — therapists and teachers alike — is bound to their uploaded availability and quota. Below is a
          cap on how many teachers (not therapists) can run sessions at the same time, banded by time of day —
          add as many bands as you need; a time outside every band is uncapped.
        </p>
        <TeacherConcurrencyList rules={teacherConcurrencyRules} />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-gray-700">Fairness</h2>
        <p className="mb-3 text-sm text-gray-500">
          Keeps a single Generate Schedule run from loading up one teacher while another sits idle. Among teachers
          who can equally cover a need, the one with fewer sessions so far this run is tried first — so a teacher
          who&apos;s behind (fewer protocol qualifications, just back from time off, etc.) gets first pick of every
          matching student until her load catches up, self-correcting as the run goes. The cap below is the backstop:
          a candidate is skipped for a slot if taking it would put her this many sessions ahead of that week&apos;s
          least-loaded teacher — a need with no one left under that cap goes unscheduled rather than breaking the
          balance. Only applies among teachers, not therapists.
        </p>
        <label className="flex max-w-xs flex-col gap-1 text-sm text-gray-700">
          Max sessions between busiest and quietest teacher
          <input
            type="number"
            min={0}
            value={maxWeeklySpread}
            onChange={(e) => {
              setMaxWeeklySpread(Number(e.target.value))
              setSaved(false)
            }}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-gray-700">No back-to-back sessions</h2>
        <p className="mb-3 text-sm text-gray-500">
          When on, two sessions with zero gap between them the same day are blocked — e.g. 15:00-16:00 immediately
          followed by 16:00-17:00. Each toggle applies independently. Applies to Generate Schedule only; Manual
          Addition is an explicit override and isn&apos;t bound by this.
        </p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={noBackToBackEnabled}
              onChange={(e) => {
                setNoBackToBackEnabled(e.target.checked)
                setSaved(false)
              }}
            />
            Don&apos;t schedule a child back-to-back — even across different teachers or protocols. Only binds
            status=&quot;Student&quot; children; status=&quot;Non-student&quot; can still be scheduled back-to-back.
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={noBackToBackTeacherEnabled}
              onChange={(e) => {
                setNoBackToBackTeacherEnabled(e.target.checked)
                setSaved(false)
              }}
            />
            Don&apos;t schedule a teacher back-to-back — even across different students or protocols
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-gray-700">Weekly minimum</h2>
        <p className="mb-3 text-sm text-gray-500">
          Every status=&quot;Student&quot; child should end the week with at least this many sessions. This never invents
          a session for a protocol she doesn&apos;t need — while she&apos;s under the floor, her existing unmet needs are
          just tried first (below explicit prioritized stars, above the normal matching order). Set to 0 to disable.
        </p>
        <label className="flex max-w-xs flex-col gap-1 text-sm text-gray-700">
          Minimum sessions per week
          <input
            type="number"
            min={0}
            value={weeklyMinimumSessions}
            onChange={(e) => {
              setWeeklyMinimumSessions(Number(e.target.value))
              setSaved(false)
            }}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-gray-700">Monthly check-in</h2>
        <p className="mb-3 text-sm text-gray-500">
          Every student gets one session with this teacher each calendar month — satisfied by any of her sessions
          with a student that month, so a student who already sees her weekly is automatically covered. There&apos;s
          no separate &quot;Monthly Check-in&quot; protocol: for anyone not yet covered, Generate Schedule tries her
          first for one of the student&apos;s own real unmet protocols, so the session delivers actual therapy, not
          a placeholder.
        </p>
        <label className="flex max-w-xs flex-col gap-1 text-sm text-gray-700">
          Teacher
          <select
            value={monthlyCheckinTeacherId}
            onChange={(e) => {
              setMonthlyCheckinTeacherId(e.target.value)
              setSaved(false)
            }}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">— Disabled —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save rules'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}
