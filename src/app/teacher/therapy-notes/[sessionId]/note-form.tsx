'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitTherapyNote, type ObjectiveRow } from '../actions'

export interface NotePrefill {
  startDate: string
  duration: string
  reviewLabel: string
  lastSessionSummary: string
  todaysProtocol: string
  repatterningNotes: string
  activeNotes: string
  parentInstructions: string
  objectives: ObjectiveRow[]
  priorObservations: string | null
}

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'
const labelClass = 'mb-1 block text-xs font-medium text-gray-600'

export function NoteForm({
  sessionId,
  weekStartDate,
  sessionDate,
  studentName,
  protocolName,
  subProtocolTitles,
  prefill,
}: {
  sessionId: string
  weekStartDate: string | null
  sessionDate: string
  studentName: string
  protocolName: string
  subProtocolTitles: string[]
  prefill: NotePrefill
}) {
  const [startDate, setStartDate] = useState(prefill.startDate)
  const [duration, setDuration] = useState(prefill.duration)
  const [reviewLabel, setReviewLabel] = useState(prefill.reviewLabel)
  const [lastSessionSummary, setLastSessionSummary] = useState(prefill.lastSessionSummary)
  const [todaysProtocol, setTodaysProtocol] = useState(prefill.todaysProtocol)
  const [repatterningNotes, setRepatterningNotes] = useState(prefill.repatterningNotes)
  const [activeNotes, setActiveNotes] = useState(prefill.activeNotes)
  const [parentInstructions, setParentInstructions] = useState(prefill.parentInstructions)
  const [objectives, setObjectives] = useState<ObjectiveRow[]>(prefill.objectives)
  const [observations, setObservations] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function updateObjective(index: number, field: keyof ObjectiveRow, value: string) {
    setObjectives((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)))
  }

  function addObjective() {
    setObjectives((prev) => [...prev, { objective: '', outcome: '' }])
  }

  function removeObjective(index: number) {
    setObjectives((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await submitTherapyNote({
        sessionPlanId: sessionId,
        weekStartDate,
        sessionDate,
        startDate,
        duration,
        reviewLabel,
        lastSessionSummary,
        todaysProtocol,
        repatterningNotes,
        activeNotes,
        parentInstructions,
        objectives,
        observations,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      router.push('/teacher/therapy-notes')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-700">Basic information</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Child&apos;s name</label>
            <p className="px-3 py-2 text-sm text-gray-900">{studentName}</p>
          </div>
          <div>
            <label className={labelClass}>Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Duration</label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 2-3 years"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Review label</label>
            <input
              type="text"
              value={reviewLabel}
              onChange={(e) => setReviewLabel(e.target.value)}
              placeholder="e.g. S08 (V)"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-700">Protocol / therapy details</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Last session</label>
            <input
              type="text"
              value={lastSessionSummary}
              onChange={(e) => setLastSessionSummary(e.target.value)}
              placeholder="e.g. 13 Aug 2026 - S07 (F)"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Today&apos;s protocol</label>
            {subProtocolTitles.length > 0 ? (
              <select value={todaysProtocol} onChange={(e) => setTodaysProtocol(e.target.value)} className={inputClass}>
                <option value="">— Select sub-protocol —</option>
                {subProtocolTitles.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
            ) : (
              <p className="px-3 py-2 text-sm text-gray-900">{protocolName}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Repatterning</label>
            <input
              type="text"
              value={repatterningNotes}
              onChange={(e) => setRepatterningNotes(e.target.value)}
              placeholder="e.g. FPR, Hands Pulling"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Active</label>
            <input
              type="text"
              value={activeNotes}
              onChange={(e) => setActiveNotes(e.target.value)}
              placeholder="e.g. Embracing Squeeze with Grounding and Gravity Line"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Homework given to parents</label>
            <textarea
              value={parentInstructions}
              onChange={(e) => setParentInstructions(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">Objectives / outcomes</h2>
          <button type="button" onClick={addObjective} className="text-xs text-blue-600 hover:underline">
            + Add row
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {objectives.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={row.objective}
                onChange={(e) => updateObjective(i, 'objective', e.target.value)}
                placeholder="Objective (e.g. Grounding and balance)"
                className={`${inputClass} w-1/3`}
              />
              <textarea
                value={row.outcome}
                onChange={(e) => updateObjective(i, 'outcome', e.target.value)}
                placeholder="What happened today"
                rows={2}
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => removeObjective(i)}
                className="self-start text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-1 text-sm font-medium text-gray-700">Observations to date</h2>
        {prefill.priorObservations && (
          <p className="mb-2 text-xs text-gray-400">Last time: {prefill.priorObservations}</p>
        )}
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={4}
          className={inputClass}
          placeholder="What happened this session"
        />
      </section>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save note & mark session complete'}
      </button>
    </form>
  )
}
