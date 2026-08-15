'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Subject } from '@/lib/supabase/types'
import { setCapability, clearCapability } from './actions'

export function CapabilityEditor({
  teacherId,
  subjects,
  ratings,
}: {
  teacherId: string
  subjects: Subject[]
  ratings: Record<string, number>
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleChange(subjectId: string, value: string) {
    startTransition(async () => {
      if (value === '') {
        await clearCapability(teacherId, subjectId)
      } else {
        await setCapability(teacherId, subjectId, Number(value))
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {subjects.map((subject) => (
        <div key={subject.id} className="flex items-center justify-between gap-3">
          <span className="text-sm">{subject.name}</span>
          <select
            defaultValue={ratings[subject.id]?.toString() ?? ''}
            disabled={isPending}
            onChange={(e) => handleChange(subject.id, e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">Not rated</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}
