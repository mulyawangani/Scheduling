'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { signUpParent } from './actions'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.set('name', name)
    formData.set('email', email)
    formData.set('phone', phone)
    formData.set('password', password)

    const result = await signUpParent(formData)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('Account created — please sign in.')
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Parent sign up</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-lg border border-gray-300 px-3 py-2"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-gray-300 px-3 py-2"
        />
        <input
          type="text"
          placeholder="Phone (for WhatsApp updates)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-gray-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="text-sm text-gray-600">
        Already have an account?{' '}
        <a href="/login" className="underline">
          Sign in
        </a>
      </p>
    </main>
  )
}
