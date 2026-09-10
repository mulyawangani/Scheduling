'use client'

import { useMemo, useState, useTransition } from 'react'
import type { StudentProtocolOption } from '@/lib/matching/unmet-needs'
import { AssignForm } from '../[studentId]/[protocolId]/assign-form'
import { getManualAssignData, type ManualAssignData } from './actions'

export function ManualPickerForm({
  students,
  protocols,
  protocolOptionsByStudent,
  weekStartDate,
}: {
  students: { id: string; name: string }[]
  protocols: { id: string; title: string }[]
  protocolOptionsByStudent: Record<string, StudentProtocolOption[]>
  weekStartDate: string
}) {
  const [studentId, setStudentId] = useState('')
  const [protocolId, setProtocolId] = useState('')
  const [assignData, setAssignData] = useState<ManualAssignData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Every protocol stays selectable — Manual Addition is the owner's explicit
  // override, so a protocol already covered this month is only ever a
  // recommendation hint (see reason below), never a hard block the way it is
  // for Generate Schedule's automatic monthly-reopening rule.
  const protocolOptions = useMemo(() => {
    const optionsForStudent = new Map((protocolOptionsByStudent[studentId] ?? []).map((o) => [o.protocolId, o]))
    return protocols.map((p) => {
      const status = optionsForStudent.get(p.id)
      return {
        id: p.id,
        title: p.title,
        reason: status?.reason ?? null,
      }
    })
  }, [protocols, protocolOptionsByStudent, studentId])

  function loadAssignData(nextStudentId: string, nextProtocolId: string) {
    setAssignData(null)
    setLoadError(null)
    if (!nextStudentId || !nextProtocolId) return
    startTransition(async () => {
      try {
        const data = await getManualAssignData(nextStudentId, nextProtocolId, weekStartDate)
        setAssignData(data)
      } catch {
        setLoadError('Could not load teacher suggestions. Please try again.')
      }
    })
  }

  function handleStudentChange(nextStudentId: string) {
    setStudentId(nextStudentId)
    loadAssignData(nextStudentId, protocolId)
  }

  function handleProtocolChange(nextProtocolId: string) {
    setProtocolId(nextProtocolId)
    loadAssignData(studentId, nextProtocolId)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Child
          <select
            value={studentId}
            onChange={(e) => handleStudentChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">Select a child</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Protocol
          <select
            value={protocolId}
            onChange={(e) => handleProtocolChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">Select a protocol</option>
            {protocolOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.reason ? ` — ${p.reason}` : ''}
              </option>
            ))}
          </select>
          {studentId && protocolOptions.some((p) => p.reason) && (
            <span className="text-xs text-gray-500">
              A note next to a protocol just means it already has a session this month — you can still pick it.
            </span>
          )}
        </label>
      </div>

      {isPending && <p className="text-sm text-gray-500">Loading teacher suggestions…</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {assignData && !isPending && (
        <div className="border-t border-gray-200 pt-6">
          <h2 className="mb-4 text-lg font-semibold">
            {assignData.studentName} — {assignData.protocolName}
          </h2>
          <AssignForm
            key={`${studentId}:${protocolId}`}
            studentId={studentId}
            protocolId={protocolId}
            candidates={assignData.candidates}
            allTeachers={assignData.allTeachers}
            onAssigned={() => loadAssignData(studentId, protocolId)}
          />
        </div>
      )}
    </div>
  )
}
