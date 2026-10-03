'use client'

import { useState, useTransition } from 'react'
import { createAnnouncement } from '../actions'

export function AnnouncementForm({ classrooms }: { classrooms: { id: string; name: string }[] }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetType, setTargetType] = useState<'ALL' | 'CLASSROOM'>('ALL')
  const [targetClassroomId, setTargetClassroomId] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT')
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await createAnnouncement({ title, body, targetType, targetClassroomId, status })
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">Title *</label>
        <input
          value={title} onChange={e => setTitle(e.target.value)} required
          placeholder="Announcement title"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 bg-white"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">Message *</label>
        <textarea
          value={body} onChange={e => setBody(e.target.value)} required rows={5}
          placeholder="Write your announcement here…"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 bg-white resize-none"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-2">Target Audience</label>
        <div className="flex gap-2">
          {(['ALL', 'CLASSROOM'] as const).map((t) => (
            <button
              key={t} type="button"
              onClick={() => setTargetType(t)}
              className="flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors"
              style={{
                borderColor: targetType === t ? '#F59030' : '#E5E7EB',
                color: targetType === t ? '#F59030' : '#6B7280',
                background: targetType === t ? '#FFF7ED' : 'white',
              }}
            >
              {t === 'ALL' ? 'All Parents' : 'Specific Classroom'}
            </button>
          ))}
        </div>
        {targetType === 'CLASSROOM' && (
          <div className="mt-2">
            <select
              value={targetClassroomId} onChange={e => setTargetClassroomId(e.target.value)} required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 bg-white"
            >
              <option value="">Select classroom…</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-2">Status</label>
        <div className="flex gap-2">
          {([
            { value: 'DRAFT', label: 'Save as Draft' },
            { value: 'PUBLISHED', label: 'Publish Now' },
          ] as const).map((s) => (
            <button
              key={s.value} type="button"
              onClick={() => setStatus(s.value)}
              className="flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors"
              style={{
                borderColor: status === s.value ? '#2FA56F' : '#E5E7EB',
                color: status === s.value ? '#2FA56F' : '#6B7280',
                background: status === s.value ? '#F0FDF4' : 'white',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending || !title.trim() || !body.trim() || (targetType === 'CLASSROOM' && !targetClassroomId)}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 mt-1"
        style={{ background: 'linear-gradient(135deg, #F59030, #DC2870)' }}
      >
        {pending ? 'Saving…' : status === 'PUBLISHED' ? 'Publish Announcement' : 'Save Draft'}
      </button>
    </form>
  )
}
