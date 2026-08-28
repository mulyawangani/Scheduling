'use client'

import { useEffect, useRef, useState } from 'react'
import type { Protocol, StudentStatus, SubProtocol } from '@/lib/supabase/types'
import { priorityLabel } from '@/lib/priority'
import { ChildProfileEditor, computeAge } from './child-profile-editor'
import { NeedsEditor, type SelectedNeed } from './needs-editor'

export function ChildCard({
  studentId,
  name,
  parentName,
  dateOfBirth,
  ratePerSession,
  priority,
  status,
  weeklyTargetSessions,
  protocols,
  subProtocolsByProtocol,
  selectedNeeds,
  autoExpand = false,
}: {
  studentId: string
  name: string
  parentName: string | undefined
  dateOfBirth: string | null
  ratePerSession: number | null
  priority: number | null
  status: StudentStatus | null
  weeklyTargetSessions: number
  protocols: Protocol[]
  subProtocolsByProtocol: Record<string, SubProtocol[]>
  selectedNeeds: SelectedNeed[]
  /** Set when a link elsewhere (e.g. Recommendation's "Edit protocols") sent the owner here for this specific child — expands the card and scrolls it into view on load, instead of leaving her to find it in the full list. */
  autoExpand?: boolean
}) {
  const [expanded, setExpanded] = useState(autoExpand)
  const liRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (autoExpand) liRef.current?.scrollIntoView({ block: 'center' })
  }, [autoExpand])

  const age = computeAge(dateOfBirth)

  return (
    <li ref={liRef} className={`flex flex-col gap-3 p-3 ${autoExpand ? 'bg-blue-50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-gray-500">Parent: {parentName}</p>
          {!expanded && (
            <p className="mt-1 text-xs text-gray-400">
              {age !== null ? `Age ${age}` : 'No DOB'} · {ratePerSession !== null ? `$${ratePerSession}/session` : 'No rate'} ·{' '}
              {priority !== null ? `Priority ${priorityLabel(priority)}` : 'No priority'} ·{' '}
              {status === 'student'
                ? 'Student'
                : status === 'non_student'
                  ? 'Non-student'
                  : status === 'inactive'
                    ? 'Inactive'
                    : 'No status'}{' '}
              · {selectedNeeds.length} protocol{selectedNeeds.length === 1 ? '' : 's'} needed · {weeklyTargetSessions}/week target
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-sm text-blue-600 hover:underline"
        >
          {expanded ? 'Collapse' : 'Edit'}
        </button>
      </div>

      {expanded && (
        <>
          <ChildProfileEditor
            studentId={studentId}
            name={name}
            dateOfBirth={dateOfBirth}
            ratePerSession={ratePerSession}
            priority={priority}
            status={status}
            weeklyTargetSessions={weeklyTargetSessions}
            onSaved={() => setExpanded(false)}
          />

          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">Protocols needed</p>
            <NeedsEditor
              studentId={studentId}
              protocols={protocols}
              subProtocolsByProtocol={subProtocolsByProtocol}
              selectedNeeds={selectedNeeds}
            />
          </div>
        </>
      )}
    </li>
  )
}
