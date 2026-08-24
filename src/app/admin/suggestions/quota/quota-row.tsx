'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTeacherQuota } from './actions'

export function QuotaRow({
  id,
  name,
  weeklyQuota,
  dailyQuota,
  commissionPerSession,
}: {
  id: string
  name: string
  weeklyQuota: number | null
  dailyQuota: number | null
  commissionPerSession: number | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [weeklyInput, setWeeklyInput] = useState(weeklyQuota?.toString() ?? '')
  const [dailyInput, setDailyInput] = useState(dailyQuota?.toString() ?? '')
  const [commissionInput, setCommissionInput] = useState(commissionPerSession?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateTeacherQuota(id, weeklyInput, dailyInput, commissionInput)
      if (result.error) {
        setError(result.error)
        return
      }
      setIsEditing(false)
      router.refresh()
    })
  }

  function handleCancel() {
    setWeeklyInput(weeklyQuota?.toString() ?? '')
    setDailyInput(dailyQuota?.toString() ?? '')
    setCommissionInput(commissionPerSession?.toString() ?? '')
    setError(null)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <tr>
        <td className="p-3">{name}</td>
        <td className="p-3">
          <input
            type="number"
            min="0"
            value={weeklyInput}
            onChange={(e) => setWeeklyInput(e.target.value)}
            className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        </td>
        <td className="p-3">
          <input
            type="number"
            min="0"
            value={dailyInput}
            onChange={(e) => setDailyInput(e.target.value)}
            className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        </td>
        <td className="p-3">
          <input
            type="number"
            min="0"
            step="0.01"
            value={commissionInput}
            onChange={(e) => setCommissionInput(e.target.value)}
            className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        </td>
        <td className="p-3">
          <div className="flex gap-3 text-sm">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="text-blue-600 hover:underline disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="text-gray-500 hover:underline disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="p-3">{name}</td>
      <td className="p-3">{weeklyQuota ?? '—'}</td>
      <td className="p-3">{dailyQuota ?? '—'}</td>
      <td className="p-3">{commissionPerSession !== null ? `$${commissionPerSession.toFixed(2)}` : '—'}</td>
      <td className="p-3">
        <button onClick={() => setIsEditing(true)} className="text-sm text-blue-600 hover:underline">
          Edit
        </button>
      </td>
    </tr>
  )
}
