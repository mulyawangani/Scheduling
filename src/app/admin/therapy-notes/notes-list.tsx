'use client'

import { useState } from 'react'

export interface NoteRow {
  id: string
  dateLabel: string
  studentName: string
  teacherName: string
  protocolName: string
  reviewLabel: string | null
  observations: string | null
  parentInstructions: string | null
}

export function NotesList({ notes }: { notes: NoteRow[] }) {
  const [teacherFilter, setTeacherFilter] = useState('')
  const [studentFilter, setStudentFilter] = useState('')

  const teacherNames = Array.from(new Set(notes.map((n) => n.teacherName))).sort()
  const studentNames = Array.from(new Set(notes.map((n) => n.studentName))).sort()

  const filtered = notes.filter((n) => {
    if (teacherFilter && n.teacherName !== teacherFilter) return false
    if (studentFilter && n.studentName !== studentFilter) return false
    return true
  })
  const isFiltered = teacherFilter !== '' || studentFilter !== ''

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">All teachers</option>
          {teacherNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">All children</option>
          {studentNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {isFiltered && (
          <button
            onClick={() => {
              setTeacherFilter('')
              setStudentFilter('')
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
        {isFiltered && (
          <span className="text-xs text-gray-400">
            {filtered.length} of {notes.length}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No notes match these filters.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {filtered.map((n) => (
            <li key={n.id} className="p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  {n.studentName} — {n.protocolName}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {n.dateLabel}
                  {n.reviewLabel ? ` · ${n.reviewLabel}` : ''}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">{n.teacherName}</p>
              {n.observations && <p className="mt-1 text-xs text-gray-600">{n.observations}</p>}
              {n.parentInstructions && (
                <p className="mt-1 text-xs text-blue-700">
                  <span className="font-medium">Homework: </span>
                  {n.parentInstructions}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
