'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParentContext } from '../parent-context'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'

// ── Types ──────────────────────────────────────────────────────────────────

type TherapyNote = {
  id: string
  session_date: string
  review_label: string | null
  todays_protocol: string | null
  repatterning_notes: string | null
  active_notes: string | null
  parent_instructions: string | null
  objectives: { objective: string; outcome: string }[] | null
  observations: string | null
  updated_at: string
  teacher_name: string | null
}

type SectionKey = 'semester' | 'weekly' | 'therapy' | 'behavior' | 'mastery'

const SECTIONS: { key: SectionKey; label: string; icon: string }[] = [
  { key: 'semester',  label: 'Semester Report',   icon: '📋' },
  { key: 'weekly',    label: 'Weekly Anecdotal',   icon: '📝' },
  { key: 'therapy',   label: 'Therapy',            icon: '🏥' },
  { key: 'behavior',  label: 'Behavior',           icon: '⭐' },
  { key: 'mastery',   label: 'Mastery',            icon: '🎯' },
]

const noteDateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TIMEZONE,
})

// ── Therapy sub-component ─────────────────────────────────────────────────

function TherapySection({ notes, loading }: { notes: TherapyNote[]; loading: boolean }) {
  if (loading) {
    return <p className="text-sm text-center py-6" style={{ color: '#9CA3AF' }}>Loading…</p>
  }
  if (notes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-2xl mb-2">🏥</p>
        <p className="text-sm" style={{ color: '#9CA3AF' }}>No therapy notes published yet.</p>
      </div>
    )
  }

  const homework = notes
    .filter(n => n.parent_instructions)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]

  return (
    <div className="flex flex-col gap-3">
      {homework && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600 mb-1">
            Homework reminder
          </p>
          <p className="text-sm text-blue-900 whitespace-pre-wrap">{homework.parent_instructions}</p>
        </div>
      )}

      {notes.map(n => {
        const objectives = (n.objectives ?? []) as { objective: string; outcome: string }[]
        return (
          <div
            key={n.id}
            className="rounded-xl p-3 text-sm"
            style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-gray-800">
                {noteDateFmt.format(new Date(`${n.session_date}T00:00:00Z`))}
                {n.review_label && (
                  <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>· {n.review_label}</span>
                )}
              </p>
              {n.teacher_name && <p className="text-xs text-gray-500">{n.teacher_name}</p>}
            </div>

            {n.todays_protocol && (
              <p className="mb-1">
                <span className="text-xs font-semibold text-gray-500">Protocol: </span>
                {n.todays_protocol}
              </p>
            )}
            {n.repatterning_notes && (
              <p className="mb-1">
                <span className="text-xs font-semibold text-gray-500">Repatterning: </span>
                {n.repatterning_notes}
              </p>
            )}
            {n.active_notes && (
              <p className="mb-1">
                <span className="text-xs font-semibold text-gray-500">Active: </span>
                {n.active_notes}
              </p>
            )}
            {objectives.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Objectives</p>
                <ul className="flex flex-col gap-1">
                  {objectives.map((o, i) => (
                    <li key={i}>
                      <span className="font-medium text-gray-800">{o.objective}</span>
                      {o.outcome && <span className="text-gray-600"> — {o.outcome}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {n.observations && (
              <p className="mt-2 whitespace-pre-wrap">
                <span className="text-xs font-semibold text-gray-500">Observations: </span>
                {n.observations}
              </p>
            )}
            {n.parent_instructions && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-blue-50 p-2 text-blue-900 text-xs">
                <span className="font-semibold text-blue-700">Homework: </span>
                {n.parent_instructions}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { kids, selectedChild } = useParentContext()
  const [open, setOpen] = useState<Set<SectionKey>>(new Set(['therapy']))
  const [therapyNotes, setTherapyNotes] = useState<TherapyNote[]>([])
  const [loadingTherapy, setLoadingTherapy] = useState(false)

  function toggle(key: SectionKey) {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  useEffect(() => {
    if (!selectedChild) return
    setLoadingTherapy(true)
    const supabase = createClient()
    supabase
      .from('session_plans')
      .select('id')
      .eq('student_id', selectedChild.id)
      .eq('status', 'completed')
      .then(async ({ data: sessions }) => {
        const ids = (sessions ?? []).map(s => s.id)
        if (ids.length === 0) {
          setTherapyNotes([])
          setLoadingTherapy(false)
          return
        }
        const { data: notes } = await supabase
          .from('therapy_notes')
          .select('id, session_date, review_label, todays_protocol, repatterning_notes, active_notes, parent_instructions, objectives, observations, updated_at, profiles!therapy_notes_teacher_id_fkey(name)')
          .in('session_plan_id', ids)
          .order('session_date', { ascending: false })
        setTherapyNotes(
          (notes ?? []).map(n => ({
            ...n,
            objectives: n.objectives as { objective: string; outcome: string }[] | null,
            teacher_name: Array.isArray(n.profiles)
              ? (n.profiles[0] as { name: string } | undefined)?.name ?? null
              : (n.profiles as { name: string } | null)?.name ?? null,
          }))
        )
        setLoadingTherapy(false)
      })
  }, [selectedChild?.id])

  if (!selectedChild || kids.length === 0) {
    return (
      <div className="p-5 text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📊</p>
        <p className="font-medium text-gray-600">No children linked</p>
        <p className="text-sm mt-1">Children will appear here once enrolled.</p>
      </div>
    )
  }

  return (
    <div className="p-5 flex flex-col gap-3 pb-8">
      <h2 className="text-lg font-bold text-gray-800">Reports</h2>

      {SECTIONS.map(({ key, label, icon }) => {
        const isOpen = open.has(key)
        return (
          <div
            key={key}
            className="bg-white rounded-2xl shadow-sm overflow-hidden"
            style={{ border: '1px solid #F3F4F6' }}
          >
            {/* Section header */}
            <button
              onClick={() => toggle(key)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base leading-none">{icon}</span>
                <span className="text-sm font-semibold text-gray-800">{label}</span>
              </div>
              <span className="text-[10px] text-gray-400">{isOpen ? '▲' : '▼'}</span>
            </button>

            {/* Section body */}
            {isOpen && (
              <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: '#F9FAFB' }}>
                {key === 'therapy' ? (
                  <TherapySection notes={therapyNotes} loading={loadingTherapy} />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-2xl mb-2">🔜</p>
                    <p className="text-sm font-medium text-gray-400">Coming soon</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
