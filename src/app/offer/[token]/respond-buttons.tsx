'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { respondToOffer } from './actions'

export function RespondButtons({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function respond(choice: 'accepted' | 'declined') {
    setError(null)
    startTransition(async () => {
      const result = await respondToOffer(token, choice)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <button
          onClick={() => respond('accepted')}
          disabled={isPending}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Accept
        </button>
        <button
          onClick={() => respond('declined')}
          disabled={isPending}
          className="flex-1 rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
