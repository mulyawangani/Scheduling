'use client'

import { useEffect, useRef, useState } from 'react'
import type { Protocol, StudentStatus, SubProtocol } from '@/lib/supabase/types'
import { priorityLabel } from '@/lib/priority'
import { formatRupiah } from '@/lib/money'
import { ChildProfileEditor, computeAge } from './child-profile-editor'
import { NeedsEditor, type SelectedNeed } from './needs-editor'

const STATUS_TEXT: Record<StudentStatus, string> = {
  trial: 'Trial',
  student: 'Student',
  non_student: 'Non-student',
  inactive: 'Inactive',
}

/** What the signed-in role may do with this card, decided on the server from the permission table. */
export type ChildCardAccess = {
  /** May open the editable profile form. */
  edit: boolean
  /** May change the status field. */
  status: boolean
  /** May see and change rate, priority and weekly target. */
  billing: boolean
  /** May delete the child. */
  delete: boolean
  /** yes = may change a child's therapy needs, view = may only see them, no = not shown. */
  needs: 'yes' | 'view' | 'no'
}

export function ChildCard({
  studentId,
  name,
  parentName,
  schoolId,
  schoolName,
  therapyLocationName,
  dateOfBirth,
  ratePerSession,
  priority,
  status,
  weeklyTargetSessions,
  schools,
  access,
  protocols,
  subProtocolsByProtocol,
  selectedNeeds,
  autoExpand = false,
}: {
  studentId: string
  name: string
  parentName: string | undefined
  schoolId: string | null
  schoolName: string | undefined
  therapyLocationName: string | undefined
  dateOfBirth: string | null
  ratePerSession: number | null
  priority: number | null
  status: StudentStatus | null
  weeklyTargetSessions: number
  schools: { id: string; name: string }[]
  access: ChildCardAccess
  protocols: Protocol[]
  subProtocolsByProtocol: Record<string, SubProtocol[]>
  selectedNeeds: SelectedNeed[]
  autoExpand?: boolean
}) {
  const [expanded, setExpanded] = useState(autoExpand)
  const liRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (autoExpand) liRef.current?.scrollIntoView({ block: 'center' })
  }, [autoExpand])

  const age = computeAge(dateOfBirth)
  const statusText = status ? STATUS_TEXT[status] : 'No status'

  return (
    <li ref={liRef} className={`flex flex-col gap-3 p-3 ${autoExpand ? 'bg-blue-50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-gray-500">Parent: {parentName}</p>
          <p className="text-xs text-gray-400">
            School: {schoolName ?? '—'} · Location: {therapyLocationName ?? '—'}
          </p>
          {!expanded && (
            <p className="mt-1 text-xs text-gray-400">
              {age !== null ? `Age ${age}` : 'No DOB'}
              {access.billing && (
                <>
                  {' · '}
                  {ratePerSession !== null ? `${formatRupiah(ratePerSession)}/session` : 'No rate'}
                  {' · '}
                  {priority !== null ? `Priority ${priorityLabel(priority)}` : 'No priority'}
                </>
              )}
              {' · '}
              {statusText}
              {access.billing && <> · {weeklyTargetSessions}/week target</>}
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-sm text-blue-600 hover:underline"
        >
          {expanded ? 'Collapse' : access.edit ? 'Edit' : 'Details'}
        </button>
      </div>

      {expanded && (
        <>
          {access.edit ? (
            <ChildProfileEditor
              studentId={studentId}
              name={name}
              dateOfBirth={dateOfBirth}
              ratePerSession={ratePerSession}
              priority={priority}
              status={status}
              weeklyTargetSessions={weeklyTargetSessions}
              schoolId={schoolId}
              schools={schools}
              can={{ status: access.status, billing: access.billing, delete: access.delete }}
              onSaved={() => setExpanded(false)}
            />
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-400">Date of birth</dt>
                <dd>{dateOfBirth ?? '—'}{age !== null ? ` (age ${age})` : ''}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Status</dt>
                <dd>{statusText}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">School</dt>
                <dd>{schoolName ?? '—'}</dd>
              </div>
            </dl>
          )}

          {access.needs !== 'no' && (
            <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500">
                Therapies needed{access.needs === 'view' ? ' (view only)' : ''}
              </p>
              <NeedsEditor
                studentId={studentId}
                protocols={protocols}
                subProtocolsByProtocol={subProtocolsByProtocol}
                selectedNeeds={selectedNeeds}
                readOnly={access.needs !== 'yes'}
              />
            </div>
          )}
        </>
      )}
    </li>
  )
}
