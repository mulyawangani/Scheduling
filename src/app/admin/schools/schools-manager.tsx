'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSchool, deleteSchool } from './actions'

export function SchoolsManager({ schools }: { schools: { id: string; name: string }[] }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  function handleCreate(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createSchool(formData)
      if (result.error) { setError(result.error); return }
      formRef.current?.reset()
      router.refresh()
    })
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will unlink any children currently assigned to this school.`)) return
    setError(null)
    startTransition(async () => {
      const result = await deleteSchool(id)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <form ref={formRef} action={handleCreate} className="flex gap-2">
        <input
          name="name"
          placeholder="School name"
          required
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add school
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {schools.length === 0 ? (
        <p className="text-sm text-gray-500">No schools yet. Add one above.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {schools.map((school) => (
            <li key={school.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium">{school.name}</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDelete(school.id, school.name)}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
