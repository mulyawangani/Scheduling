'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createChild } from './actions'

export function NewChildForm({ parents }: { parents: { id: string; name: string }[] }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createChild(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      formRef.current?.reset()
      router.refresh()
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="mb-6 flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row">
      <select name="parentId" required className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm">
        <option value="">Select parent</option>
        {parents.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        name="name"
        placeholder="Child's name"
        required
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Add child
      </button>
      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
    </form>
  )
}
