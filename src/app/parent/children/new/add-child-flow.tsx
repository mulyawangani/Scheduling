'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useParentContext } from '../../parent-context'
import { RegistrationForm, type RegistrationPrefill } from '@/app/signup/register/registration-form'

export function ChildAddedCard({
  name,
  onView,
  onAddAnother,
}: {
  name: string
  onView: () => void
  onAddAnother: () => void
}) {
  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <div
        className="px-6 py-6 text-center"
        style={{ background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)' }}
      >
        <div className="text-4xl mb-1">✅</div>
        <div className="text-white text-lg font-bold">Child added</div>
      </div>
      <div className="p-6 flex flex-col gap-4">
        <p className="text-sm text-gray-600 text-center leading-relaxed">
          <span className="font-semibold text-gray-800">{name}</span> is now on your account with
          Trial status. Our team will review the registration and contact you to confirm enrollment.
        </p>
        <button
          type="button"
          onClick={onView}
          className="w-full text-white font-semibold py-3 rounded-full"
          style={{ background: 'linear-gradient(135deg, #F59030 0%, #dc6820 100%)' }}
        >
          View profile
        </button>
        <button
          type="button"
          onClick={onAddAnother}
          className="w-full text-sm font-semibold py-2.5 rounded-full border-2"
          style={{ borderColor: '#F59030', color: '#F59030' }}
        >
          + Add another child
        </button>
      </div>
    </div>
  )
}

export function AddChildFlow({
  prefill,
  existingNames,
}: {
  prefill?: RegistrationPrefill
  existingNames: string[]
}) {
  const router = useRouter()
  const { setSelectedId } = useParentContext()
  const [added, setAdded] = useState<{ id: string; name: string } | null>(null)
  // Changing the key remounts the form, so "Add another child" starts clean with fresh prefill.
  const [formKey, setFormKey] = useState(0)

  function handleDone(child: { id: string; name: string }) {
    setSelectedId(child.id)
    setAdded(child)
    // Reload the layout's child list so the header selector and the other tabs include the new child.
    router.refresh()
  }

  if (added) {
    return (
      <div className="p-5">
        <ChildAddedCard
          name={added.name}
          onView={() => router.push('/parent/children')}
          onAddAnother={() => { setAdded(null); setFormKey(k => k + 1) }}
        />
      </div>
    )
  }

  return (
    <div className="p-5">
      <RegistrationForm
        key={formKey}
        mode="add"
        prefill={prefill}
        existingNames={existingNames}
        onDone={handleDone}
        onCancel={() => router.push('/parent/children')}
      />
    </div>
  )
}
