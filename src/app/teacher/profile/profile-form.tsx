'use client'

import { useRef, useState } from 'react'
import { updateProfile } from './actions'

export function ProfileForm({
  name,
  phone,
  email,
}: {
  name: string
  phone: string | null
  email: string
}) {
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const fd = new FormData(formRef.current!)
    const result = await updateProfile(fd)
    setSaving(false)
    setMsg(result.error ? `Error: ${result.error}` : 'Saved')
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email (login)</label>
        <input
          type="text"
          value={email}
          disabled
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
        />
        <p className="text-xs text-gray-400 mt-1">Your login credential — contact admin to change.</p>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={name}
          required
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone ?? ''}
          placeholder="+62 ..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: '#F59030' }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {msg && (
          <span className={`text-sm ${msg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
            {msg}
          </span>
        )}
      </div>
    </form>
  )
}
