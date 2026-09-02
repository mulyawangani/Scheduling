'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SuggestionCandidate, TimeSlotCandidate } from '@/lib/matching/suggest'
import { HourSelect } from '@/components/hour-select'
import { getWeekStart } from '@/lib/week'
import { approveSuggestion, manualAssign, findTeachersAtTime } from '../../actions'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Every session is a fixed 1-hour block — "09:00" in, "10:00" out. */
function addOneHour(hourString: string): string {
  const hour = Number(hourString.slice(0, 2))
  return `${String(hour + 1).padStart(2, '0')}:00`
}

/** A plain "YYYY-MM-DD" from <input type="date"> has no time-of-day ambiguity, so it's parsed
 *  as UTC midnight — same convention dateForDayOfWeek/getWeekStart already use elsewhere. */
function dayOfWeekForDate(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay()
}

export function AssignForm({
  studentId,
  protocolId,
  candidates,
  allTeachers,
  onAssigned,
}: {
  studentId: string
  protocolId: string
  candidates: SuggestionCandidate[]
  allTeachers: { id: string; name: string }[]
  /** Called after a successful assign, alongside router.refresh() — lets an embedding page (e.g. Manual Addition) know its own cached data (candidates, protocol availability) is now stale. */
  onAssigned?: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [recurrenceType, setRecurrenceType] = useState<'one_off' | 'weekly'>('weekly')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const [browseDate, setBrowseDate] = useState('')
  const [browseHour, setBrowseHour] = useState('09:00')
  const [browseResults, setBrowseResults] = useState<TimeSlotCandidate[] | null>(null)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [isBrowsing, startBrowseTransition] = useTransition()

  function handleApprove(candidate: SuggestionCandidate, window: SuggestionCandidate['freeWindows'][number]) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await approveSuggestion(
        studentId,
        protocolId,
        candidate.teacherId,
        window.dayOfWeek,
        window.startTime,
        window.endTime
      )
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess(result.whatsappError ? `Assigned, but couldn't notify by WhatsApp: ${result.whatsappError}` : 'Assigned — WhatsApp confirmation is on its way.')
      router.refresh()
      onAssigned?.()
    })
  }

  function handleBrowse() {
    if (browseDate === '') return
    setBrowseError(null)
    setBrowseResults(null)
    startBrowseTransition(async () => {
      const result = await findTeachersAtTime(
        studentId,
        protocolId,
        dayOfWeekForDate(browseDate),
        browseHour,
        addOneHour(browseHour),
        getWeekStart(new Date(`${browseDate}T00:00:00Z`))
      )
      if (result.error) {
        setBrowseError(result.error)
        return
      }
      setBrowseResults(result.candidates)
    })
  }

  function handleApproveTimeSlot(candidate: TimeSlotCandidate) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await approveSuggestion(
        studentId,
        protocolId,
        candidate.teacherId,
        dayOfWeekForDate(browseDate),
        browseHour,
        addOneHour(browseHour)
      )
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess(result.whatsappError ? `Assigned, but couldn't notify by WhatsApp: ${result.whatsappError}` : 'Assigned — WhatsApp confirmation is on its way.')
      setBrowseResults(null)
      router.refresh()
      onAssigned?.()
    })
  }

  function handleManualSubmit(formData: FormData) {
    setError(null)
    setSuccess(null)

    // Every session is a fixed 1-hour block — only a start is collected in
    // the form; derive the required end value here before submitting.
    if (recurrenceType === 'weekly') {
      const start = String(formData.get('timeOfDayStart') || '')
      if (start) formData.set('timeOfDayEnd', addOneHour(start))
    } else {
      const startDate = String(formData.get('startDate') || '')
      const startHour = String(formData.get('startHour') || '')
      if (startDate && startHour) {
        formData.set('startTime', `${startDate}T${startHour}`)
        formData.set('endTime', `${startDate}T${addOneHour(startHour)}`)
      }
    }

    startTransition(async () => {
      const result = await manualAssign(studentId, protocolId, formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess('Assigned — push the WhatsApp confirmation later from the Schedules tab.')
      router.refresh()
      onAssigned?.()
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
                    {c.teacherName}{' '}
                    <span className="text-sm font-normal text-gray-500">
                      {c.totalNeeded > 1
                        ? `covers ${c.coverageCount}/${c.totalNeeded} sub-protocols, avg rating ${c.rating.toFixed(1)}/5`
                        : `rating ${c.rating}/5`}
                    </span>
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
        <h2 className="mb-1 text-sm font-medium text-gray-700">Browse other times</h2>
        <p className="mb-2 text-xs text-gray-500">
          Not one of the slots above? Pick a date and time the child is free, and see which qualified teachers are
          open then — checked against that date&apos;s week of teacher availability. Booked the same way as the
          suggestions above: a standing weekly slot on that day, not just the one date.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={browseDate}
            onChange={(e) => {
              setBrowseDate(e.target.value)
              setBrowseResults(null)
              setBrowseError(null)
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <HourSelect
            value={browseHour}
            onChange={(e) => {
              setBrowseHour(e.target.value)
              setBrowseResults(null)
              setBrowseError(null)
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleBrowse}
            disabled={browseDate === '' || isBrowsing}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isBrowsing ? 'Checking…' : 'Find teachers'}
          </button>
        </div>
        {browseDate && (
          <p className="mt-1 text-xs text-gray-400">
            That&apos;s a {DAYS[dayOfWeekForDate(browseDate)]} — availability is checked for the week of{' '}
            {getWeekStart(new Date(`${browseDate}T00:00:00Z`))}.
          </p>
        )}

        {browseError && <p className="mt-2 text-sm text-amber-600">{browseError}</p>}

        {browseResults && (
          <ul className="mt-3 flex flex-col gap-2">
            {browseResults.length === 0 ? (
              <p className="text-sm text-gray-500">No qualified teacher is free at that time.</p>
            ) : (
              browseResults.map((c) => (
                <li key={c.teacherId} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm">
                  <span>
                    <span className="font-medium">{c.teacherName}</span>{' '}
                    <span className="text-gray-500">
                      {c.totalNeeded > 1
                        ? `covers ${c.coverageCount}/${c.totalNeeded} sub-protocols, avg rating ${c.rating.toFixed(1)}/5`
                        : `rating ${c.rating}/5`}{' '}
                      · {c.scorePercent}% match
                    </span>
                  </span>
                  <button
                    onClick={() => handleApproveTimeSlot(c)}
                    disabled={isPending}
                    className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </li>
              ))
            )}
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
            // key={recurrenceType} forces a full remount when switching modes —
            // without it, React reuses the HourSelect at this same grid
            // position across both branches (same component type, same tree
            // position), so a value picked in one mode could silently carry
            // over into the other mode's differently-named field.
            <div key="weekly" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select name="day" required defaultValue="" className="rounded-lg border border-gray-300 px-3 py-2">
                <option value="" disabled>
                  Day
                </option>
                {DAYS.map((day, i) => (
                  <option key={day} value={i}>
                    {day}
                  </option>
                ))}
              </select>
              <HourSelect name="timeOfDayStart" required className="rounded-lg border border-gray-300 px-3 py-2" />
            </div>
          ) : (
            <div key="one_off" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input type="date" name="startDate" required className="rounded-lg border border-gray-300 px-3 py-2" />
              <HourSelect name="startHour" required className="rounded-lg border border-gray-300 px-3 py-2" />
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
