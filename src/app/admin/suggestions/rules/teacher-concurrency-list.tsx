'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TeacherConcurrencyRule } from '@/lib/supabase/types'
import { HourSelect } from '@/components/hour-select'
import { createTeacherConcurrencyRule, deleteTeacherConcurrencyRule } from './actions'

export function TeacherConcurrencyList({ rules }: { rules: TeacherConcurrencyRule[] }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleCreate(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createTeacherConcurrencyRule(formData)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  function handleDelete(ruleId: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteTeacherConcurrencyRule(ruleId)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={handleCreate} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row">
        <HourSelect name="startTime" required className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <HourSelect name="endTime" required className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input
          type="number"
          name="maxConcurrent"
          min="1"
          placeholder="Max teachers"
          required
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add band
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rules.length === 0 ? (
        <p className="text-sm text-gray-500">No bands yet — teachers aren&apos;t capped at any time.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between p-3 text-sm">
              <span>
                {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)}: max {rule.max_concurrent} teachers
              </span>
              <button
                onClick={() => handleDelete(rule.id)}
                disabled={isPending}
                className="text-red-600 hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
