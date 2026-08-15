'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Subject } from '@/lib/supabase/types'
import { ownerToggleSubject } from './actions'

export function NeedsEditor({
  studentId,
  subjects,
  selectedSubjectIds,
}: {
  studentId: string
  subjects: Subject[]
  selectedSubjectIds: string[]
}) {
  const [selected, setSelected] = useState(new Set(selectedSubjectIds))
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle(subjectId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(subjectId)
      } else {
        next.delete(subjectId)
      }
      return next
    })
    startTransition(async () => {
      await ownerToggleSubject(studentId, subjectId, checked)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap gap-3">
      {subjects.map((subject) => (
        <label key={subject.id} className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={selected.has(subject.id)}
            disabled={isPending}
            onChange={(e) => handleToggle(subject.id, e.target.checked)}
          />
          {subject.name}
        </label>
      ))}
    </div>
  )
}
