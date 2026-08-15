'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SuggestionCandidate } from '@/lib/matching/suggest'
import { approveSuggestion, manualAssign } from '../../actions'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function AssignForm({
  studentId,
  subjectId,
  candidates,
  allTeachers,
}: {
  studentId: string
  subjectId: string
  candidates: SuggestionCandidate[]
  allTeachers: { id: string; name: string }[]
}) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [recurrenceType, setRecurrenceType] = useState<'one_off' | 'weekly'>('weekly')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleApprove(candidate: SuggestionCandidate, window: SuggestionCandidate['freeWindows'][number]) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await approveSuggestion(
        studentId,
        subjectId,
        candidate.teacherId,
        window.dayOfWeek,
        window.startTime,
        window.endTime
      )
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess(result.whatsappError ? `Assigned, but WhatsApp failed: ${result.whatsappError}` : 'Assigned and sent via WhatsApp.')
      router.refresh()
    })
  }

  function handleManualSubmit(formData: FormData) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await manualAssign(studentId, subjectId, formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess(result.whatsappError ? `Assigned, but WhatsApp failed: ${result.whatsappError}` : 'Assigned and sent via WhatsApp.')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {success}{' '}
          <Link href="/admin/suggestions" className="underline">
            Back to queue
          </Link>
        </div>
      )}
      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Algorithm suggestions</h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-gray-500">No qualified teacher has a matching free slot.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {candidates.map((c) => (
              <li key={c.teacherId} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {c.teacherName} <span className="text-sm font-normal text-gray-500">rating {c.rating}/5</span>
                  </p>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {c.scorePercent}% match
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {c.freeWindows.map((w, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>
                        {DAYS[w.dayOfWeek]} {w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}
                      </span>
                      <button
                        onClick={() => handleApprove(c, w)}
                        disabled={isPending}
                        className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Manual override</h2>
        <form action={handleManualSubmit} className="flex flex-col gap-3">
          <select name="teacherId" required className="rounded-lg border border-gray-300 px-3 py-2">
            <option value="">Select teacher</option>
            {allTeachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            name="recurrenceType"
            value={recurrenceType}
            onChange={(e) => setRecurrenceType(e.target.value as 'one_off' | 'weekly')}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="weekly">Weekly recurring</option>
            <option value="one_off">One-off</option>
          </select>

          {recurrenceType === 'weekly' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select name="day" defaultValue="" className="rounded-lg border border-gray-300 px-3 py-2">
                <option value="">Day</option>
                {DAYS.map((day, i) => (
                  <option key={day} value={i}>
                    {day}
                  </option>
                ))}
              </select>
              <input
                type="time"
                name="timeOfDayStart"
                className="rounded-lg border border-gray-300 px-3 py-2"
              />
              <input type="time" name="timeOfDayEnd" className="rounded-lg border border-gray-300 px-3 py-2" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="datetime-local"
                name="startTime"
                className="rounded-lg border border-gray-300 px-3 py-2"
              />
              <input type="datetime-local" name="endTime" className="rounded-lg border border-gray-300 px-3 py-2" />
            </div>
          )}

          <textarea
            name="note"
            placeholder="Note (optional)"
            rows={2}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="self-start rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Assigning…' : 'Assign manually'}
          </button>
        </form>
      </section>
    </div>
  )
}
