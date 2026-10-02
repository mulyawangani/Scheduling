'use client'

import { useState } from 'react'
import { setTeacherProtocol, removeTeacherProtocol } from './actions'

type Protocol = { id: string; title: string }
type Certified = { protocol_id: string; rating: number }

export function ProtocolsGrid({
  protocols,
  certified,
}: {
  protocols: Protocol[]
  certified: Certified[]
}) {
  const [state, setState] = useState<Record<string, { checked: boolean; rating: number }>>(() => {
    const map: Record<string, { checked: boolean; rating: number }> = {}
    for (const p of protocols) {
      const c = certified.find((c) => c.protocol_id === p.id)
      map[p.id] = { checked: !!c, rating: c?.rating ?? 3 }
    }
    return map
  })
  const [saving, setSaving] = useState<string | null>(null)

  async function handleToggle(protocolId: string, checked: boolean) {
    const current = state[protocolId]
    setSaving(protocolId)
    setState((prev) => ({ ...prev, [protocolId]: { ...prev[protocolId], checked } }))
    if (checked) {
      await setTeacherProtocol(protocolId, current.rating)
    } else {
      await removeTeacherProtocol(protocolId)
    }
    setSaving(null)
  }

  async function handleRating(protocolId: string, rating: number) {
    setSaving(protocolId)
    setState((prev) => ({ ...prev, [protocolId]: { ...prev[protocolId], rating } }))
    await setTeacherProtocol(protocolId, rating)
    setSaving(null)
  }

  if (protocols.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">
        No active protocols found. Ask your admin to add protocols first.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {protocols.map((p) => {
        const { checked, rating } = state[p.id]
        const isSaving = saving === p.id
        return (
          <div
            key={p.id}
            className="flex items-center gap-4 rounded-xl px-4 py-3 transition-colors"
            style={{
              border: checked ? '1.5px solid #F59030' : '1px solid #E5E7EB',
              background: checked ? 'rgba(245,144,48,0.04)' : 'white',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={isSaving}
              onChange={(e) => handleToggle(p.id, e.target.checked)}
              className="w-4 h-4 flex-shrink-0"
              style={{ accentColor: '#F59030' }}
            />
            <span className="flex-1 text-sm font-medium text-gray-800">{p.title}</span>
            {checked && (
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleRating(p.id, star)}
                    className="text-lg leading-none hover:scale-110 transition-transform"
                    style={{ color: star <= rating ? '#F59030' : '#D1D5DB' }}
                    title={`Rate ${star}/5`}
                  >
                    ★
                  </button>
                ))}
                <span className="text-xs text-gray-400 ml-1.5 tabular-nums">{rating}/5</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
