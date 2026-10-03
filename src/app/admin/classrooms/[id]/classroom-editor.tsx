'use client'

import { useState, useTransition } from 'react'
import { updateClassroom } from '../actions'

export function ClassroomEditor({
  id, name: initName, ageGroup: initAgeGroup,
  primaryTeacherId: initPrimary, secondaryTeacherId: initSecondary,
  active: initActive, teachers,
}: {
  id: string
  name: string
  ageGroup: string
  primaryTeacherId: string
  secondaryTeacherId: string
  active: boolean
  teachers: { id: string; name: string }[]
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initName)
  const [ageGroup, setAgeGroup] = useState(initAgeGroup)
  const [primaryTeacherId, setPrimaryTeacherId] = useState(initPrimary)
  const [secondaryTeacherId, setSecondaryTeacherId] = useState(initSecondary)
  const [active, setActive] = useState(initActive)
  const [pending, startTransition] = useTransition()

  function save(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await updateClassroom(id, { name, ageGroup, primaryTeacherId, secondaryTeacherId, active })
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="self-start text-xs font-semibold text-orange-500 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-50"
      >
        Edit Classroom Settings
      </button>
    )
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-700">Edit Classroom</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Classroom Name *</label>
          <input
            value={name} onChange={e => setName(e.target.value)} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Age Group</label>
          <input
            value={ageGroup} onChange={e => setAgeGroup(e.target.value)}
            placeholder="e.g. 3–6 years"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Lead Teacher</label>
          <select
            value={primaryTeacherId} onChange={e => setPrimaryTeacherId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white"
          >
            <option value="">— None —</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Assistant Teacher</label>
          <select
            value={secondaryTeacherId} onChange={e => setSecondaryTeacherId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white"
          >
            <option value="">— None —</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="accent-orange-500" />
        Active classroom
      </label>
      <div className="flex gap-2 justify-end">
        <button
          type="button" onClick={() => setEditing(false)}
          className="text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg bg-white"
        >
          Cancel
        </button>
        <button
          type="submit" disabled={pending || !name.trim()}
          className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #F59030, #DC2870)' }}
        >
          {pending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
