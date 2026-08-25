'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { dateForDayOfWeek } from '@/lib/week'
import { BUSINESS_TIMEZONE } from '@/lib/timezone'
import type { GeneratedSchedule } from '@/lib/matching/generate-schedule'
import { commitSimulatedSession, commitAllSimulatedSessions, deleteSession, deleteNeeds } from './actions'
import { saveScheduleVersion } from './versions-actions'
import { createSchedule, addExistingSessionsToSchedule } from './schedules/actions'
import { CollapsibleSection } from '@/components/collapsible-section'

const WEEKDAYS = [1, 2, 3, 4, 5]
const DAY_NAMES: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' }
const HOURS = Array.from({ length: 9 }, (_, i) => 8 + i) // 8:00 through 16:00 (last block ends 17:00)
const dateLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', timeZone: BUSINESS_TIMEZONE })

function cellKey(day: number, hour: number) {
  return `${day}-${hour}`
}

export function ScheduleGrid({ schedule }: { schedule: GeneratedSchedule }) {
  const [committing, setCommitting] = useState<Set<number>>(new Set())
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [savingVersion, setSavingVersion] = useState(false)
  const [saveVersionError, setSaveVersionError] = useState<string | null>(null)
  const [creatingSchedule, setCreatingSchedule] = useState(false)
  const [createScheduleError, setCreateScheduleError] = useState<string | null>(null)
  const [addingExisting, setAddingExisting] = useState(false)
  const [addExistingError, setAddExistingError] = useState<string | null>(null)
  const [clearingProposals, setClearingProposals] = useState<Set<number>>(new Set())
  const [bookingAllTotal, setBookingAllTotal] = useState<number | null>(null)
  const [bookingAllElapsed, setBookingAllElapsed] = useState(0)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Ticks while "Book all" is in flight so the button can show real elapsed
  // time — not a fake progress bar, just proof the request hasn't stalled.
  useEffect(() => {
    if (bookingAllTotal === null) return
    setBookingAllElapsed(0)
    const interval = setInterval(() => setBookingAllElapsed((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [bookingAllTotal])

  // Booking runs as one long sequential server request with no way to report
  // partial progress back mid-flight — a refresh while it's running aborts
  // that request, leaving whatever had already been committed in place and
  // silently dropping the rest. Warn before the tab can be closed/reloaded
  // out from under an in-progress booking.
  useEffect(() => {
    if (committing.size === 0) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [committing.size])

  function handleSaveVersion() {
    setSaveVersionError(null)
    setSavingVersion(true)
    startTransition(async () => {
      const result = await saveScheduleVersion(
        schedule.weekStartDate,
        schedule.proposals,
        schedule.unscheduled,
        schedule.existing.length
      )
      setSavingVersion(false)
      if (result.error) {
        setSaveVersionError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleCreateSchedule() {
    if (!confirm(`Book all ${schedule.proposals.length} proposed sessions into a new schedule? WhatsApp notifications aren't sent yet — you'll push them from the Schedules tab.`)) return
    setCreateScheduleError(null)
    setCreatingSchedule(true)
    startTransition(async () => {
      const result = await createSchedule(schedule.weekStartDate, schedule.proposals)
      setCreatingSchedule(false)
      if (result.error) {
        setCreateScheduleError(result.error)
        return
      }
      router.push('/admin/suggestions/schedules')
    })
  }

  function handleAddExistingToSchedule() {
    if (
      !confirm(
        `Add all ${schedule.existing.length} already-scheduled sessions this week to a new schedule for WhatsApp push? This doesn't book or change anything — it just groups them so you can notify parents from the Schedules tab.`
      )
    )
      return
    setAddExistingError(null)
    setAddingExisting(true)
    startTransition(async () => {
      const result = await addExistingSessionsToSchedule(
        schedule.weekStartDate,
        schedule.existing.map((e) => e.id)
      )
      setAddingExisting(false)
      if (result.error) {
        setAddExistingError(result.error)
        return
      }
      router.push('/admin/suggestions/schedules')
    })
  }

  function handleDeleteSession(sessionId: string, label: string) {
    if (!confirm(`Delete "${label}"? This cancels the session.`)) return
    setDeleteError(null)
    setDeleting((prev) => new Set(prev).add(sessionId))
    startTransition(async () => {
      const result = await deleteSession(sessionId)
      if (result.error) {
        setDeleteError(result.error)
        setDeleting((prev) => {
          const next = new Set(prev)
          next.delete(sessionId)
          return next
        })
        return
      }
      router.refresh()
    })
  }

  function handleCommit(index: number) {
    const p = schedule.proposals[index]
    setCommitting((prev) => new Set(prev).add(index))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
    startTransition(async () => {
      const result = await commitSimulatedSession(p.studentId, p.protocolId, p.teacherId, p.date, p.startTime, p.endTime)
      if (result.error) {
        setErrors((prev) => ({ ...prev, [index]: result.error as string }))
        setCommitting((prev) => {
          const next = new Set(prev)
          next.delete(index)
          return next
        })
        return
      }
      router.refresh()
    })
  }

  function handleCommitAll() {
    setErrors({})
    setCommitting(new Set(schedule.proposals.map((_, i) => i)))
    setBookingAllTotal(schedule.proposals.length)
    startTransition(async () => {
      const result = await commitAllSimulatedSessions(
        schedule.proposals.map((p) => ({
          studentId: p.studentId,
          protocolId: p.protocolId,
          teacherId: p.teacherId,
          date: p.date,
          startTime: p.startTime,
          endTime: p.endTime,
        }))
      )
      const newErrors: Record<number, string> = {}
      for (const e of result.errors) newErrors[e.index] = e.error
      setErrors(newErrors)
      setCommitting(new Set())
      setBookingAllTotal(null)
      router.refresh()
    })
  }

  function handleClearProposal(index: number) {
    const p = schedule.proposals[index]
    if (!confirm(`Remove "${p.studentName} — ${p.protocolName}" from her needs, so it stops being proposed? This cannot be undone.`)) return
    setErrors((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
    setClearingProposals((prev) => new Set(prev).add(index))
    startTransition(async () => {
      const result = await deleteNeeds(p.needIds)
      if (result.error) {
        setErrors((prev) => ({ ...prev, [index]: result.error as string }))
        setClearingProposals((prev) => {
          const next = new Set(prev)
          next.delete(index)
          return next
        })
        return
      }
      router.refresh()
    })
  }

  const existingByCell = new Map<string, typeof schedule.existing>()
  for (const e of schedule.existing) {
    const key = cellKey(e.dayOfWeek, Number(e.startTime.slice(0, 2)))
    const arr = existingByCell.get(key) ?? []
    arr.push(e)
    existingByCell.set(key, arr)
  }

  const proposedByCell = new Map<string, number[]>()
  schedule.proposals.forEach((p, i) => {
    const key = cellKey(p.dayOfWeek, Number(p.startTime.slice(0, 2)))
    const arr = proposedByCell.get(key) ?? []
    arr.push(i)
    proposedByCell.set(key, arr)
  })

  const holidayByDate = new Map(schedule.holidays.map((h) => [h.date, h]))

  const scheduledByTeacher = new Map<string, number>()
  for (const e of schedule.existing) scheduledByTeacher.set(e.teacherName, (scheduledByTeacher.get(e.teacherName) ?? 0) + 1)
  const proposedByTeacher = new Map<string, number>()
  for (const p of schedule.proposals) proposedByTeacher.set(p.teacherName, (proposedByTeacher.get(p.teacherName) ?? 0) + 1)

  // Teacher x protocol matrix — same idea as the child matrix below: which
  // protocols is each teacher actually covering this week, at a glance.
  interface TeacherMatrixCell {
    studentName: string
    kind: 'scheduled' | 'proposed'
  }
  const teacherMatrixNames = Array.from(new Set([...scheduledByTeacher.keys(), ...proposedByTeacher.keys()])).sort(
    (a, b) => a.localeCompare(b)
  )
  const teacherProtocolNames = Array.from(
    new Set([...schedule.existing.map((e) => e.protocolName), ...schedule.proposals.map((p) => p.protocolName)])
  ).sort((a, b) => a.localeCompare(b))
  const teacherMatrixCellKey = (teacherName: string, protocolName: string) => `${teacherName}::${protocolName}`
  const teacherMatrixCells = new Map<string, TeacherMatrixCell[]>()
  for (const e of schedule.existing) {
    const key = teacherMatrixCellKey(e.teacherName, e.protocolName)
    const arr = teacherMatrixCells.get(key) ?? []
    arr.push({ studentName: e.studentName, kind: 'scheduled' })
    teacherMatrixCells.set(key, arr)
  }
  for (const p of schedule.proposals) {
    const key = teacherMatrixCellKey(p.teacherName, p.protocolName)
    const arr = teacherMatrixCells.get(key) ?? []
    arr.push({ studentName: p.studentName, kind: 'proposed' })
    teacherMatrixCells.set(key, arr)
  }

  const scheduledByStudent = new Map<string, number>()
  for (const e of schedule.existing) scheduledByStudent.set(e.studentName, (scheduledByStudent.get(e.studentName) ?? 0) + 1)
  const proposedByStudent = new Map<string, number>()
  for (const p of schedule.proposals) proposedByStudent.set(p.studentName, (proposedByStudent.get(p.studentName) ?? 0) + 1)

  // Child x protocol matrix — alphabetical on both axes, since this is for
  // scanning ("does this kid have Reflex Repatterning this week?"), not for
  // ranking by volume the way the teacher list above is.
  interface MatrixCell {
    teacherName: string
    kind: 'scheduled' | 'proposed'
  }
  const matrixStudentNames = Array.from(new Set([...scheduledByStudent.keys(), ...proposedByStudent.keys()])).sort((a, b) =>
    a.localeCompare(b)
  )
  const matrixProtocolNames = Array.from(
    new Set([...schedule.existing.map((e) => e.protocolName), ...schedule.proposals.map((p) => p.protocolName)])
  ).sort((a, b) => a.localeCompare(b))
  const matrixCellKey = (studentName: string, protocolName: string) => `${studentName}::${protocolName}`
  const matrixCells = new Map<string, MatrixCell[]>()
  for (const e of schedule.existing) {
    const key = matrixCellKey(e.studentName, e.protocolName)
    const arr = matrixCells.get(key) ?? []
    arr.push({ teacherName: e.teacherName, kind: 'scheduled' })
    matrixCells.set(key, arr)
  }
  for (const p of schedule.proposals) {
    const key = matrixCellKey(p.studentName, p.protocolName)
    const arr = matrixCells.get(key) ?? []
    arr.push({ teacherName: p.teacherName, kind: 'proposed' })
    matrixCells.set(key, arr)
  }

  // Children with a real unmet need this week who didn't land a single
  // session out of it — not a count of how many needs went unmet, just
  // whether they end the week with zero allocation at all. A child with one
  // unscheduled need but a different need that did get placed doesn't count.
  const allocatedStudentNames = new Set([...scheduledByStudent.keys(), ...proposedByStudent.keys()])
  const unassignedStudentNames = Array.from(new Set(schedule.unscheduled.map((u) => u.studentName)))
    .filter((name) => !allocatedStudentNames.has(name))
    .sort((a, b) => a.localeCompare(b))

  return (
    <div className="flex flex-col gap-4">
      {schedule.holidays.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-medium">Holidays this week</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {schedule.holidays.map((h) => (
              <li key={h.date}>
                {dateLabelFormatter.format(new Date(`${h.date}T00:00:00Z`))} — {h.name}{' '}
                <span className="text-amber-600">({h.type === 'public' ? 'public, everyone blocked' : 'school, students blocked'})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <CollapsibleSection title="Weekly grid" defaultOpen={false}>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-0.5"></th>
              {WEEKDAYS.map((day) => {
                const date = dateForDayOfWeek(schedule.weekStartDate, day)
                const holiday = holidayByDate.get(date)
                return (
                  <th key={day} className="p-0.5 text-center font-medium text-gray-600">
                    {DAY_NAMES[day]}
                    <div className="font-normal text-gray-400">{dateLabelFormatter.format(new Date(`${date}T00:00:00Z`))}</div>
                    {holiday && (
                      <div className={`mt-0.5 rounded px-1 text-[9px] font-medium ${holiday.type === 'public' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {holiday.name}
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour} className="border-t border-gray-100">
                <td className="whitespace-nowrap p-0.5 text-right text-gray-500">{hour}:00</td>
                {WEEKDAYS.map((day) => {
                  const key = cellKey(day, hour)
                  const existingHere = existingByCell.get(key) ?? []
                  const proposedHere = proposedByCell.get(key) ?? []
                  return (
                    <td key={day} className="p-0.5 align-top">
                      <div className="flex flex-col gap-0.5">
                        {existingHere.map((e) => (
                          <div
                            key={e.id}
                            className={`rounded px-1 py-0.5 ${e.holidayConflict ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}
                            title={e.holidayConflict ? 'Falls on a holiday — was booked before the holiday was declared' : undefined}
                          >
                            <span className="font-semibold">S{schedule.existing.indexOf(e) + 1}</span> {e.teacherName} ·{' '}
                            {e.studentName}
                            {e.holidayConflict && ' ⚠'}
                          </div>
                        ))}
                        {proposedHere.map((idx) => (
                          <div key={`p-${idx}`} className="rounded bg-blue-50 px-1 py-0.5 text-blue-700">
                            <span className="font-semibold">P{idx + 1}</span>{' '}
                            {schedule.proposals[idx].prioritized && <span className="text-amber-500">★</span>}{' '}
                            {schedule.proposals[idx].teacherName} · {schedule.proposals[idx].studentName}
                          </div>
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </CollapsibleSection>

      {teacherMatrixNames.length > 0 && (
        <CollapsibleSection title="Sessions per teacher this week" defaultOpen={false}>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-700">Teacher</th>
                  {teacherProtocolNames.map((name) => (
                    <th key={name} className="p-2 text-left font-medium text-gray-700">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teacherMatrixNames.map((teacherName) => {
                  const total = (scheduledByTeacher.get(teacherName) ?? 0) + (proposedByTeacher.get(teacherName) ?? 0)
                  return (
                  <tr key={teacherName} className="border-t border-gray-100">
                    <td className="sticky left-0 z-10 bg-white p-2 font-medium">
                      {teacherName} <span className="font-normal text-gray-400">({total})</span>
                    </td>
                    {teacherProtocolNames.map((protocolName) => {
                      const cells = teacherMatrixCells.get(teacherMatrixCellKey(teacherName, protocolName)) ?? []
                      return (
                        <td key={protocolName} className="p-2 align-top">
                          {cells.length === 0 ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {cells.map((c, i) => (
                                <span
                                  key={i}
                                  className={`whitespace-nowrap rounded px-1 py-0.5 ${c.kind === 'scheduled' ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-700'}`}
                                >
                                  {c.studentName}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {matrixStudentNames.length > 0 && (
        <CollapsibleSection title="Sessions per child this week" defaultOpen={false}>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-700">Child</th>
                  {matrixProtocolNames.map((name) => (
                    <th key={name} className="p-2 text-left font-medium text-gray-700">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixStudentNames.map((studentName) => (
                  <tr key={studentName} className="border-t border-gray-100">
                    <td className="sticky left-0 z-10 bg-white p-2 font-medium">{studentName}</td>
                    {matrixProtocolNames.map((protocolName) => {
                      const cells = matrixCells.get(matrixCellKey(studentName, protocolName)) ?? []
                      return (
                        <td key={protocolName} className="p-2 align-top">
                          {cells.length === 0 ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {cells.map((c, i) => (
                                <span
                                  key={i}
                                  className={`whitespace-nowrap rounded px-1 py-0.5 ${c.kind === 'scheduled' ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-700'}`}
                                >
                                  {c.teacherName}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {unassignedStudentNames.length > 0 && (
        <CollapsibleSection title={`Children with no session this week (${unassignedStudentNames.length})`} defaultOpen={false}>
          <ul className="flex flex-col divide-y divide-yellow-200 rounded-lg border border-yellow-200 bg-yellow-50">
            {unassignedStudentNames.map((name) => (
              <li key={name} className="p-2 text-sm">
                {name}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSaveVersion}
          disabled={savingVersion || isPending}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {savingVersion ? 'Saving…' : 'Save this as a version'}
        </button>
        {saveVersionError && <span className="text-sm text-red-600">{saveVersionError}</span>}
        {schedule.proposals.length > 0 && (
          <>
            <button
              onClick={handleCreateSchedule}
              disabled={creatingSchedule || isPending}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingSchedule ? 'Creating…' : 'Create schedule'}
            </button>
            {createScheduleError && <span className="text-sm text-red-600">{createScheduleError}</span>}
          </>
        )}
      </div>

      {schedule.existing.length > 0 && (
        <CollapsibleSection
          title={`Scheduled sessions (${schedule.existing.length})`}
          defaultOpen={false}
          actions={
            <div className="flex items-center gap-3">
              <button
                onClick={handleAddExistingToSchedule}
                disabled={addingExisting || isPending}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {addingExisting ? 'Adding…' : 'Add to Schedules (WhatsApp push)'}
              </button>
              {addExistingError && <span className="text-sm text-red-600">{addExistingError}</span>}
            </div>
          }
        >
          {deleteError && <p className="mb-2 text-sm text-red-600">{deleteError}</p>}
          <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
            {schedule.existing.map((e, i) => (
              <li key={e.id} className={`flex items-center justify-between p-3 text-sm ${e.holidayConflict ? 'bg-red-50' : ''}`}>
                <div>
                  <p className="font-medium">
                    <span className="text-gray-400">S{i + 1}</span> {e.studentName} — {e.protocolName} with{' '}
                    {e.teacherName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {DAY_NAMES[e.dayOfWeek]} {dateLabelFormatter.format(new Date(`${e.date}T00:00:00Z`))} ·{' '}
                    {e.startTime.slice(0, 5)}–{e.endTime.slice(0, 5)}
                  </p>
                  {e.holidayConflict && (
                    <p className="text-xs font-medium text-red-600">⚠ Falls on a holiday — booked before it was declared</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteSession(e.id, `${e.studentName} — ${e.protocolName}`)}
                  disabled={isPending || deleting.has(e.id)}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {schedule.proposals.length > 0 && (
        <CollapsibleSection
          title={`Proposed sessions (${schedule.proposals.length})`}
          defaultOpen={false}
          actions={
            <button
              onClick={handleCommitAll}
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {bookingAllTotal !== null && (
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {bookingAllTotal !== null ? `Booking ${bookingAllTotal} sessions… (${bookingAllElapsed}s)` : 'Book all'}
            </button>
          }
        >
          {bookingAllTotal !== null && (
            <p className="mb-2 text-xs text-gray-500">
              Each session is checked against capacity and booked one at a time — this can take a few seconds per
              session. It&apos;s safe to leave this tab open; don&apos;t close or refresh it until this finishes.
            </p>
          )}
          <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
            {schedule.proposals.map((p, i) => (
              <li key={i} className={`flex items-center justify-between p-3 text-sm ${p.prioritized ? 'bg-blue-50' : ''}`}>
                <div>
                  <p className="font-medium">
                    <span className="text-gray-400">P{i + 1}</span>{' '}
                    {p.prioritized && <span className="text-amber-500">★</span>} {p.studentName} — {p.protocolName}{' '}
                    with {p.teacherName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {DAY_NAMES[p.dayOfWeek]} {dateLabelFormatter.format(new Date(`${p.date}T00:00:00Z`))} ·{' '}
                    {p.startTime.slice(0, 5)}–{p.endTime.slice(0, 5)} · {p.matchScorePercent}% match
                    {p.totalNeeded > 1 && ` · covers ${p.coverageCount}/${p.totalNeeded} sub-protocols`}
                  </p>
                  {errors[i] && <p className="text-xs text-red-600">{errors[i]}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => handleCommit(i)}
                    disabled={isPending || committing.has(i)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {committing.has(i) ? 'Booking…' : 'Book'}
                  </button>
                  <button
                    onClick={() => handleClearProposal(i)}
                    disabled={isPending || clearingProposals.has(i)}
                    className="text-sm text-red-600 hover:underline disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {schedule.unscheduled.length > 0 && (
        <CollapsibleSection title={`Not scheduled (${schedule.unscheduled.length})`} defaultOpen={false}>
          <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-yellow-200 bg-yellow-50">
            {schedule.unscheduled.map((u, i) => (
              <li key={i} className="p-3 text-sm">
                {u.prioritized && <span className="text-amber-500">★</span>} {u.studentName} — {u.protocolName}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {schedule.proposals.length === 0 && schedule.unscheduled.length === 0 && (
        <p className="text-sm text-gray-500">No unmet needs to schedule this week.</p>
      )}
    </div>
  )
}
