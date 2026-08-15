'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelSession } from './actions'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export interface SessionRow {
  id: string
  recurrenceType: 'one_off' | 'weekly'
  startTime: string | null
  endTime: string | null
  dayOfWeek: number | null
  timeOfDayStart: string | null
  timeOfDayEnd: string | null
  status: string
  teacherName: string
  subjectName: string
}

export function SessionsList({ studentId, sessions }: { studentId: string; sessions: SessionRow[] }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleCancel(sessionId: string) {
    startTransition(async () => {
      await cancelSession(studentId, sessionId)
      router.refresh()
    })
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-gray-500">No sessions scheduled yet.</p>
  }

  return (
    <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
      {sessions.map((s) => {
        const when =
          s.recurrenceType === 'one_off' && s.startTime && s.endTime
            ? `${dateFormatter.format(new Date(s.startTime))} – ${dateFormatter.format(new Date(s.endTime))}`
            : `Every ${DAYS[s.dayOfWeek ?? 0]} ${s.timeOfDayStart?.slice(0, 5)}–${s.timeOfDayEnd?.slice(0, 5)}`
        return (
          <li key={s.id} className="flex items-center justify-between gap-3 p-3">
            <div>
              <p className="font-medium">
                {s.subjectName} with {s.teacherName}
              </p>
              <p className="text-sm text-gray-500">{when}</p>
              <span className="text-xs uppercase text-gray-400">{s.status}</span>
            </div>
            <button
              onClick={() => handleCancel(s.id)}
              disabled={isPending}
              className="text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              Cancel
            </button>
          </li>
        )
      })}
    </ul>
  )
}
