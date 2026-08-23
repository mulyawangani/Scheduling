'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Holiday } from '@/lib/supabase/types'
import { createHoliday, deleteHoliday } from './actions'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function HolidayCalendar({ monthParam, days, holidays }: { monthParam: string; days: string[]; holidays: Holiday[] }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const byDate = new Map(holidays.map((h) => [h.date, h]))

  function handleCreate(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createHoliday(formData)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteHoliday(id)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={handleCreate} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row">
        <input
          type="date"
          name="date"
          required
          defaultValue={`${monthParam}-01`}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          name="name"
          placeholder="Holiday name"
          required
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select name="type" defaultValue="school" className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="school">School holiday</option>
          <option value="public">Public holiday</option>
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-gray-50 p-2 text-center font-medium text-gray-500">
            {label}
          </div>
        ))}
        {days.map((date) => {
          const holiday = byDate.get(date)
          const inMonth = date.slice(0, 7) === monthParam
          const dayNum = Number(date.slice(8, 10))
          const bg = holiday?.type === 'public' ? 'bg-red-50' : holiday?.type === 'school' ? 'bg-amber-50' : inMonth ? 'bg-white' : 'bg-gray-50'
          return (
            <div key={date} className={`flex min-h-[76px] flex-col gap-1 p-2 ${bg}`}>
              <span className={inMonth ? 'text-gray-700' : 'text-gray-300'}>{dayNum}</span>
              {holiday && (
                <div className="flex flex-col gap-1">
                  <span
                    className={`rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${
                      holiday.type === 'public' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {holiday.name}
                  </span>
                  <button
                    onClick={() => handleDelete(holiday.id)}
                    disabled={isPending}
                    className="self-start text-[10px] text-gray-400 hover:text-red-600 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-amber-100" /> School holiday — clears &quot;Student&quot; children&apos;s
          school-hours availability that date
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-red-100" /> Public holiday — blocks scheduling for everyone that date
        </span>
      </div>
    </div>
  )
}
