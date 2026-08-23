'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Protocol, SubProtocol } from '@/lib/supabase/types'
import {
  createProtocol,
  deleteProtocol,
  createSubProtocol,
  deleteSubProtocol,
  toggleProtocolActive,
  toggleSubProtocolActive,
} from './actions'

export function ProtocolLibrary({
  protocols,
  subProtocolsByProtocol,
}: {
  protocols: Protocol[]
  subProtocolsByProtocol: Record<string, SubProtocol[]>
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleCreateProtocol(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createProtocol(formData)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  function handleDeleteProtocol(protocolId: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteProtocol(protocolId)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  function handleToggleProtocolActive(protocolId: string, isActive: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await toggleProtocolActive(protocolId, isActive)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  function handleToggleSubProtocolActive(subProtocolId: string, isActive: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await toggleSubProtocolActive(subProtocolId, isActive)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  function handleCreateSubProtocol(protocolId: string, formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createSubProtocol(protocolId, formData)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  function handleDeleteSubProtocol(subProtocolId: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteSubProtocol(subProtocolId)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form action={handleCreateProtocol} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row">
        <input
          name="title"
          placeholder="New protocol title"
          required
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          name="instructions"
          placeholder="Instructions (optional)"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add protocol
        </button>
      </form>

      {protocols.length === 0 ? (
        <p className="text-sm text-gray-500">No protocols yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {protocols.map((protocol) => {
            const subProtocols = subProtocolsByProtocol[protocol.id] ?? []
            return (
              <li key={protocol.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{protocol.title}</p>
                    {protocol.instructions && <p className="text-sm text-gray-500">{protocol.instructions}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleProtocolActive(protocol.id, !protocol.is_active)}
                      disabled={isPending}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                        protocol.is_active
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {protocol.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => handleDeleteProtocol(protocol.id)}
                      disabled={isPending}
                      className="text-sm text-red-600 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {subProtocols.length > 0 && (
                  <ul className="mt-2 flex flex-col divide-y divide-gray-100 pl-4">
                    {subProtocols.map((sp) => (
                      <li key={sp.id} className="flex items-center justify-between py-1 text-sm">
                        <span>{sp.title}</span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleSubProtocolActive(sp.id, !sp.is_active)}
                            disabled={isPending}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                              sp.is_active
                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {sp.is_active ? 'Active' : 'Inactive'}
                          </button>
                          <button
                            onClick={() => handleDeleteSubProtocol(sp.id)}
                            disabled={isPending}
                            className="text-red-600 hover:underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  action={(formData) => handleCreateSubProtocol(protocol.id, formData)}
                  className="mt-2 flex gap-2 pl-4"
                >
                  <input
                    name="title"
                    placeholder="New sub-protocol"
                    required
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-gray-800 px-3 py-1 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
                  >
                    Add
                  </button>
                </form>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
