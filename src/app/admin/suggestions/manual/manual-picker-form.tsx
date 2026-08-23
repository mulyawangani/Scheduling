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

  // Protocols the child doesn't have as a declared need at all stay selectable with no
  // annotation (manual override), same as before this feature existed — only a protocol
  // she's already covered this month gets greyed out with a reason.
  const protocolOptions = useMemo(() => {
    const optionsForStudent = new Map((protocolOptionsByStudent[studentId] ?? []).map((o) => [o.protocolId, o]))
    return protocols.map((p) => {
      const status = optionsForStudent.get(p.id)
      return {
        id: p.id,
        title: p.title,
        disabled: status ? !status.available : false,
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
    const optionsForStudent = new Map((protocolOptionsByStudent[nextStudentId] ?? []).map((o) => [o.protocolId, o]))
    const currentStatus = optionsForStudent.get(protocolId)
    const nextProtocolId = currentStatus && !currentStatus.available ? '' : protocolId
    setProtocolId(nextProtocolId)
    loadAssignData(nextStudentId, nextProtocolId)
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
              <option key={p.id} value={p.id} disabled={p.disabled}>
                {p.title}
                {p.reason ? ` — ${p.reason}` : ''}
              </option>
            ))}
          </select>
          {studentId && protocolOptions.some((p) => p.disabled) && (
            <span className="text-xs text-gray-500">Greyed out protocols already have a session for this child this month.</span>
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
