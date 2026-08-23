'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Protocol, SubProtocol } from '@/lib/supabase/types'
import { ownerToggleProtocol } from './actions'

export interface SelectedNeed {
  protocolId: string
  subProtocolId: string | null
}

function needKey(protocolId: string, subProtocolId: string | null) {
  return subProtocolId ?? protocolId
}

export function NeedsEditor({
  studentId,
  protocols,
  subProtocolsByProtocol,
  selectedNeeds,
}: {
  studentId: string
  protocols: Protocol[]
  subProtocolsByProtocol: Record<string, SubProtocol[]>
  selectedNeeds: SelectedNeed[]
}) {
  const [selected, setSelected] = useState(new Set(selectedNeeds.map((n) => needKey(n.protocolId, n.subProtocolId))))
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle(protocolId: string, subProtocolId: string | null, checked: boolean) {
    const key = needKey(protocolId, subProtocolId)
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
    startTransition(async () => {
      await ownerToggleProtocol(studentId, protocolId, subProtocolId, checked)
      router.refresh()
    })
  }

  function renderItem(protocolId: string, subProtocolId: string | null, label: string) {
    const key = needKey(protocolId, subProtocolId)
    const checked = selected.has(key)
    return (
      <label key={key} className="flex items-center gap-1 text-sm">
        <input
          type="checkbox"
          checked={checked}
          disabled={isPending}
          onChange={(e) => handleToggle(protocolId, subProtocolId, e.target.checked)}
        />
        {label}
      </label>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {protocols.map((protocol) => {
        const subProtocols = subProtocolsByProtocol[protocol.id] ?? []
        if (subProtocols.length > 0) {
          return (
            <div key={protocol.id}>
              <p className="mb-1 text-xs font-medium text-gray-500">{protocol.title}</p>
              <div className="flex flex-wrap gap-3 pl-2">
                {subProtocols.map((sp) => renderItem(protocol.id, sp.id, sp.title))}
              </div>
            </div>
          )
        }
        return renderItem(protocol.id, null, protocol.title)
      })}
    </div>
  )
}
