'use client'

import { useTransition, useRef, useState } from 'react'
import { addBehaviorLog } from './actions'

type Student = { id: string; name: string; classroom: string | null }

const LOG_TYPES = [
  { value: 'behavior',  label: 'Behavior' },
  { value: 'hygiene',   label: 'Hygiene' },
  { value: 'health',    label: 'Health' },
  { value: 'milestone', label: 'Milestone' },
]

const SEVERITIES = [
  { value: 'low',    label: 'Low',    color: '#16A34A' },
  { value: 'medium', label: 'Medium', color: '#D97706' },
  { value: 'high',   label: 'High',   color: '#DC2626' },
]

export function BehaviorLogForm({ students }: { students: Student[] }) {
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState('behavior')
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      await addBehaviorLog(data)
      formRef.current?.reset()
      setType('behavior')
    })
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-sm text-gray-800">New Log Entry</h2>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
        {/* Student */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Student</label>
          <select
            name="student_id"
            required
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
          >
            <option value="">Select a student…</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.classroom ? ` — ${s.classroom}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Type</label>
          <div className="flex gap-2 flex-wrap">
            {LOG_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors"
                style={{
                  background: type === t.value ? '#EFF6FF' : '#F9FAFB',
                  color:      type === t.value ? '#1D4ED8' : '#6B7280',
                  borderColor: type === t.value ? '#BFDBFE' : '#E5E7EB',
                }}
              >
                {t.label}
              </button>
            ))}
            <input type="hidden" name="type" value={type} />
          </div>
        </div>

        {/* Severity (behavior only) */}
        {type === 'behavior' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Severity</label>
            <div className="flex gap-2">
              {SEVERITIES.map(s => (
                <label key={s.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="severity" value={s.value} className="accent-blue-500" />
                  <span className="text-xs font-medium" style={{ color: s.color }}>{s.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Description <span className="text-red-400">*</span></label>
          <textarea
            name="description"
            required
            rows={3}
            placeholder="Describe what you observed…"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="self-end px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ background: '#F59030', color: '#fff' }}
        >
          {pending ? 'Saving…' : 'Save Log'}
        </button>
      </form>
    </div>
  )
}
