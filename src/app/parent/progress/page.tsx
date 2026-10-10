'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParentContext } from '../parent-context'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'

// ── types ──────────────────────────────────────────────────────────────────

type SessionPlan = {
  id: string
  recurrence_type: string
  start_time: string | null
  day_of_week: number | null
  time_of_day_start: string | null
  status: string
  created_at: string
  protocol_title: string | null
  teacher_name: string | null
}

type TherapyNote = {
  id: string
  session_date: string
  todays_protocol: string | null
  observations: string | null
  parent_instructions: string | null
  active_notes: string | null
  teacher_name: string | null
  session_plan_id: string
}

type ProtocolStat = { title: string; count: number; lastDate: string }

// ── helpers ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const noteDateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TIMEZONE,
})

const monthFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short', year: 'numeric', timeZone: BUSINESS_TIMEZONE,
})

function getMonthKey(dateStr: string) {
  return dateStr.slice(0, 7) // YYYY-MM
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── sub-components ──────────────────────────────────────────────────────────

function StatCard({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 text-center flex-1" style={{ border: '1px solid #F3F4F6' }}>
      <p className="text-3xl font-bold leading-none" style={{ color }}>{value}</p>
      <p className="text-[10px] font-semibold text-gray-400 mt-1.5 leading-tight uppercase tracking-wide">{label}</p>
    </div>
  )
}

function ProtocolBar({ title, count, max }: { title: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-700 truncate">{title}</p>
          <p className="text-xs font-bold text-gray-500 flex-shrink-0 ml-2">{count} session{count !== 1 ? 's' : ''}</p>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #F59030, #DC2870)' }}
          />
        </div>
      </div>
    </div>
  )
}

// ── main page ───────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const { selectedChild, kids } = useParentContext()
  const [sessions, setSessions] = useState<SessionPlan[]>([])
  const [notes, setNotes] = useState<TherapyNote[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedChild) return
    setLoading(true)
    const supabase = createClient()

    supabase
      .from('session_plans')
      .select('id, recurrence_type, start_time, day_of_week, time_of_day_start, status, created_at, protocols(title), profiles!session_plans_teacher_id_fkey(name)')
      .eq('student_id', selectedChild.id)
      .order('created_at', { ascending: false })
      .then(({ data: rows }) => {
        const mapped: SessionPlan[] = (rows ?? []).map(r => {
          const rv = r as unknown as {
            id: string; recurrence_type: string; start_time: string | null
            day_of_week: number | null; time_of_day_start: string | null
            status: string; created_at: string
            protocols: { title: string } | { title: string }[] | null
            profiles: { name: string } | { name: string }[] | null
          }
          return {
            id: rv.id,
            recurrence_type: rv.recurrence_type,
            start_time: rv.start_time,
            day_of_week: rv.day_of_week,
            time_of_day_start: rv.time_of_day_start,
            status: rv.status,
            created_at: rv.created_at,
            protocol_title: Array.isArray(rv.protocols)
              ? rv.protocols[0]?.title ?? null
              : (rv.protocols as { title: string } | null)?.title ?? null,
            teacher_name: Array.isArray(rv.profiles)
              ? rv.profiles[0]?.name ?? null
              : (rv.profiles as { name: string } | null)?.name ?? null,
          }
        })
        setSessions(mapped)

        const completedIds = mapped.filter(s => s.status === 'completed').map(s => s.id)
        if (completedIds.length === 0) { setNotes([]); setLoading(false); return }

        supabase
          .from('therapy_notes')
          .select('id, session_date, todays_protocol, observations, parent_instructions, active_notes, session_plan_id, profiles!therapy_notes_teacher_id_fkey(name)')
          .in('session_plan_id', completedIds)
          .order('session_date', { ascending: false })
          .limit(20)
          .then(({ data: noteRows }) => {
            setNotes((noteRows ?? []).map(n => {
              const nv = n as unknown as {
                id: string; session_date: string; todays_protocol: string | null
                observations: string | null; parent_instructions: string | null
                active_notes: string | null; session_plan_id: string
                profiles: { name: string } | { name: string }[] | null
              }
              return {
                id: nv.id,
                session_date: nv.session_date,
                todays_protocol: nv.todays_protocol,
                observations: nv.observations,
                parent_instructions: nv.parent_instructions,
                active_notes: nv.active_notes,
                session_plan_id: nv.session_plan_id,
                teacher_name: Array.isArray(nv.profiles)
                  ? nv.profiles[0]?.name ?? null
                  : (nv.profiles as { name: string } | null)?.name ?? null,
              }
            })
            )
            setLoading(false)
          })
      })
  }, [selectedChild?.id])

  if (!selectedChild || kids.length === 0) {
    return (
      <div className="p-5 text-center py-20 text-gray-400">
        <p className="text-4xl mb-3">📈</p>
        <p className="font-semibold text-gray-600">No children linked</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-5 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-gray-800">Progress</h2>
        <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  const completed = sessions.filter(s => s.status === 'completed')
  const upcoming = sessions.filter(s => s.status === 'pending' || s.status === 'accepted')
  // Sessions the teacher marked a no-show: the child did not come and the session was not cancelled
  const noShows = sessions
    .filter(s => s.status === 'no_show' && s.start_time)
    .sort((a, b) => (b.start_time ?? '').localeCompare(a.start_time ?? ''))

  // This month
  const now = new Date()
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const completedThisMonth = notes.filter(n => getMonthKey(n.session_date) === thisMonthKey).length

  // Protocol breakdown from notes
  const protocolMap = new Map<string, ProtocolStat>()
  for (const n of notes) {
    const title = n.todays_protocol ?? 'General Therapy'
    const existing = protocolMap.get(title)
    if (!existing || n.session_date > existing.lastDate) {
      protocolMap.set(title, {
        title,
        count: (existing?.count ?? 0) + 1,
        lastDate: n.session_date,
      })
    } else {
      protocolMap.set(title, { ...existing, count: existing.count + 1 })
    }
  }
  const protocols = Array.from(protocolMap.values()).sort((a, b) => b.count - a.count)
  const maxProtoCount = protocols[0]?.count ?? 1

  // Monthly trend (last 6 months)
  const monthlyMap = new Map<string, number>()
  for (const n of notes) {
    const key = getMonthKey(n.session_date)
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1)
  }
  const monthlyData = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
  const maxMonthly = Math.max(...monthlyData.map(([, v]) => v), 1)

  return (
    <div className="p-5 flex flex-col gap-4 pb-8">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Progress</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {selectedChild.nickname ?? selectedChild.name} · therapy journey
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-2">
        <StatCard value={completed.length} label="Completed" color="#22C55E" />
        <StatCard value={completedThisMonth} label="This Month" color="#F59030" />
        <StatCard value={upcoming.length} label="Upcoming" color="#3B82F6" />
      </div>

      {/* Monthly trend */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #F3F4F6' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
            Sessions per Month
          </p>
          <div className="flex items-end gap-2 h-20">
            {monthlyData.map(([key, count]) => {
              const pct = (count / maxMonthly) * 100
              const isThisMonth = key === thisMonthKey
              return (
                <div key={key} className="flex-1 flex flex-col items-center gap-1">
                  <p className="text-[9px] font-bold text-gray-500">{count}</p>
                  <div className="w-full rounded-t-lg transition-all" style={{
                    height: `${Math.max(pct, 8)}%`,
                    background: isThisMonth
                      ? 'linear-gradient(180deg, #F59030, #DC2870)'
                      : '#E5E7EB',
                  }} />
                  <p className="text-[8px] text-gray-400 text-center leading-tight">
                    {monthFmt.format(new Date(`${key}-01T00:00:00Z`)).replace(' ', '\n')}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Protocol breakdown */}
      {protocols.length > 0 && (
        <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #F3F4F6' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
            Protocols Worked On
          </p>
          <div className="flex flex-col gap-3">
            {protocols.map(p => (
              <ProtocolBar key={p.title} title={p.title} count={p.count} max={maxProtoCount} />
            ))}
          </div>
        </div>
      )}

      {/* Therapy notes timeline */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #F3F4F6' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: '#F9FAFB' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Session History
          </p>
        </div>

        {notes.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm text-gray-400">No session notes published yet.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: '#F9FAFB' }}>
            {notes.map(n => (
              <div key={n.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-gray-800">
                    {noteDateFmt.format(new Date(`${n.session_date}T00:00:00Z`))}
                  </p>
                  {n.teacher_name && (
                    <p className="text-[10px] text-gray-400 flex-shrink-0">{n.teacher_name}</p>
                  )}
                </div>
                {n.todays_protocol && (
                  <span
                    className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1.5"
                    style={{ background: 'rgba(245,144,48,0.1)', color: '#F59030' }}
                  >
                    {n.todays_protocol}
                  </span>
                )}
                {n.observations && (
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{n.observations}</p>
                )}
                {n.active_notes && !n.observations && (
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{n.active_notes}</p>
                )}
                {n.parent_instructions && (
                  <p className="text-[11px] text-blue-700 mt-1.5 font-medium">
                    📝 {n.parent_instructions.length > 80 ? n.parent_instructions.slice(0, 80) + '…' : n.parent_instructions}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming sessions */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #F3F4F6' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: '#F9FAFB' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Upcoming Sessions
            </p>
          </div>
          <div className="flex flex-col divide-y" style={{ borderColor: '#F9FAFB' }}>
            {upcoming.slice(0, 5).map(s => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                  style={{ background: 'rgba(245,144,48,0.1)' }}
                >
                  🏥
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800">
                    {s.recurrence_type === 'one_off' && s.start_time
                      ? noteDateFmt.format(new Date(s.start_time))
                      : s.day_of_week !== null
                      ? `Every ${DAY_LABELS[s.day_of_week]} · ${s.time_of_day_start?.slice(0, 5) ?? ''}`
                      : '—'}
                  </p>
                  {s.protocol_title && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.protocol_title}</p>
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: s.status === 'accepted' ? 'rgba(34,197,94,0.1)' : 'rgba(245,144,48,0.1)',
                    color: s.status === 'accepted' ? '#16a34a' : '#F59030',
                  }}
                >
                  {capitalize(s.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No-show sessions */}
      {noShows.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #F3F4F6' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: '#F9FAFB' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              No-show Sessions
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Your child did not come and the session was not cancelled.
            </p>
          </div>
          <div className="flex flex-col divide-y" style={{ borderColor: '#F9FAFB' }}>
            {noShows.slice(0, 5).map(s => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                  style={{ background: 'rgba(225,29,72,0.1)' }}
                >
                  🏥
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800">
                    {noteDateFmt.format(new Date(s.start_time as string))}
                  </p>
                  {(s.protocol_title || s.teacher_name) && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {[s.protocol_title, s.teacher_name ? `with ${s.teacher_name}` : null].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(225,29,72,0.1)', color: '#be123c' }}
                >
                  No-show
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coming soon: Academic progress */}
      <div
        className="rounded-2xl p-4"
        style={{ border: '1px dashed #E5E7EB', background: '#FAFAFA' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-2">
          Coming after platform merge
        </p>
        <div className="flex flex-col gap-2">
          {[
            { icon: '🎯', label: 'Montessori mastery map (5 areas)' },
            { icon: '📚', label: 'Academic age vs. chronological age' },
            { icon: '🔍', label: 'Gap analysis per learning area' },
            { icon: '📐', label: 'Lesson plan progress' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-base leading-none">{item.icon}</span>
              <p className="text-xs text-gray-300">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
