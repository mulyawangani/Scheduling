'use client'

import { useState, useTransition } from 'react'
import { assignStudentToClassroom, removeStudentFromClassroom } from '../actions'

function age(dob: string | null) {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  let years = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) years--
  return years
}

export function StudentRoster({
  classroomId, enrolled, unassigned,
}: {
  classroomId: string
  enrolled: { id: string; name: string; date_of_birth: string | null; status: string }[]
  unassigned: { id: string; name: string; status: string }[]
}) {
  const [addId, setAddId] = useState('')
  const [pending, startTransition] = useTransition()

  function addStudent() {
    if (!addId) return
    startTransition(async () => {
      await assignStudentToClassroom(addId, classroomId)
      setAddId('')
    })
  }

  function remove(studentId: string) {
    startTransition(() => removeStudentFromClassroom(studentId, classroomId))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">
          Students <span className="text-gray-400 font-normal">({enrolled.length})</span>
        </h2>
        {unassigned.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={addId} onChange={e => setAddId(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400 bg-white"
            >
              <option value="">Add student…</option>
              {unassigned.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={addStudent}
              disabled={!addId || pending}
              className="text-xs font-semibold text-white px-2.5 py-1.5 rounded-lg disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #F59030, #DC2870)' }}
            >
              Add
            </button>
          </div>
        )}
      </div>

      {enrolled.length === 0 ? (
        <p className="text-sm text-gray-400">No students enrolled in this classroom yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {enrolled.map((s) => {
            const a = age(s.date_of_birth)
            return (
              <li key={s.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900">{s.name}</span>
                  {a !== null && (
                    <span className="text-xs text-gray-400 ml-2">{a} y/o</span>
                  )}
                  {s.status !== 'active' && (
                    <span className="text-[10px] font-semibold ml-2 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
                      {s.status}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => remove(s.id)}
                  disabled={pending}
                  className="text-xs font-medium text-gray-400 hover:text-red-500 disabled:opacity-40 flex-shrink-0"
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
