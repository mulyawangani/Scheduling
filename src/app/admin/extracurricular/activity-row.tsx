'use client'

import { useState, useTransition } from 'react'
import { updateActivity } from './actions'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)

export function ActivityRow({
  id,
  name,
  isActive,
  monthlyPrice,
}: {
  id: string
  name: string
  isActive: boolean
  monthlyPrice: number | null
}) {
  const [price, setPrice] = useState(monthlyPrice === null ? '' : String(monthlyPrice))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const typedPrice = price === '' ? null : Number(price)
  const dirty = typedPrice !== monthlyPrice

  function run(changes: { monthlyPrice?: number | null; isActive?: boolean }) {
    setError(null)
    startTransition(async () => {
      const result = await updateActivity(id, changes)
      if (result.error) setError(result.error)
    })
  }

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[140px] flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{name}</span>
            {!isActive && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-400">Hidden</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-gray-400">
            {isActive ? 'Parents can sign up' : 'Parents cannot sign up'}
            {' · '}
            {monthlyPrice !== null ? `Rp ${fmt(monthlyPrice)} / month` : 'No price set'}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Rp</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1000"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="Not set"
            aria-label={`Monthly price for ${name}`}
            className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-right text-sm outline-none focus:border-orange-400"
          />
        </div>

        <button
          onClick={() => run({ monthlyPrice: typedPrice })}
          disabled={!dirty || pending}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #F59030, #DC2870)' }}
        >
          {pending ? '…' : 'Save'}
        </button>

        <button
          onClick={() => run({ isActive: !isActive })}
          disabled={pending}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 disabled:opacity-50"
        >
          {isActive ? 'Hide' : 'Offer'}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </li>
  )
}
