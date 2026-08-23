'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateParentProfile } from './actions'
import { PrioritySelect } from './priority-select'

export function ParentRow({
  id,
  name,
  email,
  phone,
  priorityTier,
}: {
  id: string
  name: string
  email: string | null
  phone: string | null
  priorityTier: number
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [nameInput, setNameInput] = useState(name)
  const [phoneInput, setPhoneInput] = useState(phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateParentProfile(id, nameInput, phoneInput)
      if (result.error) {
        setError(result.error)
        return
      }
      setIsEditing(false)
      router.refresh()
    })
  }

  if (isEditing) {
    return (
      <li className="flex flex-col gap-2 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Name"
            className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
          <input
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="Phone (for WhatsApp)"
            className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false)
                setNameInput(name)
                setPhoneInput(phone ?? '')
                setError(null)
              }}
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400">Email ({email}) isn&apos;t editable here — it&apos;s tied to her login.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between gap-3 p-3">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-gray-500">{email}</p>
        {phone && <p className="text-sm text-gray-500">{phone}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <PrioritySelect parentId={id} tier={priorityTier} />
        <button onClick={() => setIsEditing(true)} className="text-sm text-blue-600 hover:underline">
          Edit
        </button>
      </div>
    </li>
  )
}
