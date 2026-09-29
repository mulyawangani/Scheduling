'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function FloatingInput({
  id, label, type = 'text', value, onChange, required, rightSlot,
}: {
  id: string; label: string; type?: string; value: string
  onChange: (v: string) => void; required?: boolean; rightSlot?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  const floated = focused || value.length > 0
  return (
    <div className="relative">
      <input
        id={id} type={type} value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        className="w-full border-2 rounded-xl px-4 pt-6 pb-2 text-sm outline-none transition-colors bg-white"
        style={{
          borderColor: focused ? '#F59030' : '#E5E7EB',
          paddingRight: rightSlot ? '3rem' : undefined,
        }}
      />
      <label
        htmlFor={id}
        className="absolute pointer-events-none transition-all duration-150"
        style={{
          left: 16, top: floated ? 6 : '50%',
          transform: floated ? 'none' : 'translateY(-50%)',
          fontSize: floated ? 11 : 14,
          color: floated ? '#F59030' : '#9CA3AF',
        }}
      >
        {label}
      </label>
      {rightSlot && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
      )}
    </div>
  )
}

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Could not create account. Please try again.')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      role: 'parent',
      name,
      email,
      phone: phone || null,
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    window.location.href = '/signup/terms'
  }

  return (
    <div className="playtics-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div
          className="px-6 py-5 text-center"
          style={{ background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)' }}
        >
          <div className="text-white text-2xl font-bold tracking-widest">PLAYTICS</div>
          <div className="text-orange-100 text-xs mt-1 tracking-wide">Create Account</div>
        </div>

        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800">Join Playtics</h2>
          <p className="text-gray-400 text-sm mb-6">Create your parent account</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FloatingInput id="name" label="Full Name" value={name} onChange={setName} required />
            <FloatingInput id="email" label="Email Address" type="email" value={email} onChange={setEmail} required />
            <FloatingInput id="phone" label="Phone / WhatsApp" type="tel" value={phone} onChange={setPhone} />
            <FloatingInput
              id="password" label="Password (min. 6 characters)"
              type={showPw ? 'text' : 'password'} value={password} onChange={setPassword} required
              rightSlot={
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? '🙈' : '👁'}
                </button>
              }
            />

            {error && (
              <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl px-4 py-2">{error}</p>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full text-white font-semibold py-3 rounded-full transition-all mt-2"
              style={{ background: loading ? '#ccc' : 'linear-gradient(135deg, #F59030 0%, #dc6820 100%)' }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-5">
            Already have an account?{' '}
            <a href="/login" className="font-semibold" style={{ color: '#F59030' }}>Login</a>
          </p>
        </div>
      </div>
    </div>
  )
}
