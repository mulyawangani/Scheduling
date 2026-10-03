'use client'

import { useState, useTransition } from 'react'
import { createClassroom } from './actions'

export function NewClassroomForm({ teachers }: { teachers: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [primaryTeacherId, setPrimaryTeacherId] = useState('')
  const [secondaryTeacherId, setSecondaryTeacherId] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await createClassroom({ name, ageGroup, primaryTeacherId, secondaryTeacherId })
      setOpen(false)
      setName('')
      setAgeGroup('')
      setPrimaryTeacherId('')
      setSecondaryTeacherId('')
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
        style={{ background: 'linear-gradient(135deg, #F59030, #DC2870)' }}
      >
        + New Classroom
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="w-full mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-700">New Classroom</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Classroom Name *</label>
          <input
            value={name} onChange={e => setName(e.target.value)} required
            placeholder="e.g. Butterfly Room"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Age Group</label>
          <input
            value={ageGroup} onChange={e => setAgeGroup(e.target.value)}
            placeholder="e.g. 3–6 years"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
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
      <div className="flex gap-2 justify-end">
        <button
          type="button" onClick={() => setOpen(false)}
          className="text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg bg-white"
        >
          Cancel
        </button>
        <button
          type="submit" disabled={pending || !name.trim()}
          className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #F59030, #DC2870)' }}
        >
          {pending ? 'Creating…' : 'Create Classroom'}
        </button>
      </div>
    </form>
  )
}
