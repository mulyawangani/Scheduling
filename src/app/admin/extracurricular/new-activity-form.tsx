'use client'

import { useState, useTransition } from 'react'
import { createActivity } from './actions'

export function NewActivityForm() {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createActivity(name, price === '' ? null : Number(price))
      if (result.error) {
        setError(result.error)
        return
      }
      setName('')
      setPrice('')
    })
  }

  return (
    <form onSubmit={submit} className="mb-4 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700">Add an activity</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs text-gray-500">Activity name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="e.g. Ballet"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Monthly price</label>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Rp</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1000"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="250000"
              className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-right text-sm outline-none focus:border-orange-400"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #F59030, #DC2870)' }}
        >
          {pending ? 'Adding…' : 'Add activity'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  )
}
