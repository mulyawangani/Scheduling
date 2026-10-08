'use client'

import { RegistrationForm } from './registration-form'

export default function RegisterPage() {
  return (
    <div className="playtics-bg min-h-screen flex items-center justify-center p-4">
      <RegistrationForm
        mode="signup"
        onDone={() => { window.location.href = '/signup/done' }}
      />
    </div>
  )
}
