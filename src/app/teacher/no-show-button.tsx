'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markNoShow, undoNoShow } from './actions'

/**
 * "No-show" for a session the student did not come to (and that was not cancelled), and "Undo" for a mark made by
 * mistake. The server checks that the session is the signed-in teacher's own and that it has started.
 */
export function NoShowButton({
  sessionId,
  label,
  mode = 'mark',
  className = '',
}: {
  sessionId: string
  /** Who or what the session is, for the confirmation question ("Aiden"). */
  label: string
  mode?: 'mark' | 'undo'
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    const question =
      mode === 'mark'
        ? `Mark ${label} as a no-show? Use this when the student did not come and the session was not cancelled.`
        : `Undo the no-show for ${label}? The session goes back to confirmed, so you can write its note.`
    if (!confirm(question)) return
    setError(null)
    startTransition(async () => {
      const result = mode === 'mark' ? await markNoShow(sessionId) : await undoNoShow(sessionId)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={handleClick} disabled={isPending} className={`whitespace-nowrap disabled:opacity-50 ${className}`}>
        {isPending ? 'Saving…' : mode === 'mark' ? 'No-show' : 'Undo no-show'}
      </button>
      {error && <span className="block text-[10px] text-red-600">{error}</span>}
    </>
  )
}
