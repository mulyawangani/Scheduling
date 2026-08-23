'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTeacher } from './actions'

export function NewTeacherForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createTeacher(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      formRef.current?.reset()
      router.refresh()
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
      <input
        name="name"
        placeholder="Teacher name"
        required
        className="rounded-lg border border-gray-300 px-3 py-2"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="rounded-lg border border-gray-300 px-3 py-2"
      />
      <input
        name="password"
        type="password"
        placeholder="Temporary password"
        required
        minLength={6}
        className="rounded-lg border border-gray-300 px-3 py-2"
      />
      <select name="status" defaultValue="teacher" className="rounded-lg border border-gray-300 px-3 py-2">
        <option value="teacher">Teacher</option>
        <option value="therapist">Therapist</option>
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Creating…' : 'Add teacher'}
      </button>
      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
    </form>
  )
}
