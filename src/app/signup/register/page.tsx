'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function FloatingInput({
  id, label, type = 'text', value, onChange, required,
}: {
  id: string; label: string; type?: string; value: string
  onChange: (v: string) => void; required?: boolean
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
        style={{ borderColor: focused ? '#F59030' : '#E5E7EB' }}
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
    </div>
  )
}

function FloatingSelect({
  id, label, value, onChange, options,
}: {
  id: string; label: string; value: string
  onChange: (v: string) => void
  options: string[] | { value: string; label: string }[]
}) {
  const [focused, setFocused] = useState(false)
  const floated = focused || value.length > 0
  const normalised = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  )
  return (
    <div className="relative">
      <select
        id={id} value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full border-2 rounded-xl px-4 pt-6 pb-2 text-sm outline-none transition-colors bg-white appearance-none"
        style={{ borderColor: focused ? '#F59030' : '#E5E7EB', color: value ? '#111827' : 'transparent' }}
      >
        <option value="">Select…</option>
        {normalised.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
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
    </div>
  )
}

const STEPS = [
  { title: "Child's Information", icon: '👶', subtitle: 'Step 1 of 4' },
  { title: "Father's Information", icon: '👨', subtitle: 'Step 2 of 4' },
  { title: "Mother's Information", icon: '👩', subtitle: 'Step 3 of 4' },
  { title: 'Emergency Contact', icon: '🚨', subtitle: 'Step 4 of 4' },
]

type ChildData = { fullName: string; nickname: string; dateOfBirth: string; gender: string; nationality: string; religion: string; address: string; phoneHome: string; previousSchool: string; schoolId: string }
type ParentData = { fullName: string; phoneMobile: string; phoneHome: string; email: string; dateOfBirth: string; employment: string }
type EmergencyData = { fullName: string; phoneMobile: string; relationship: string }

export default function RegisterPage() {
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    createClient().from('schools').select('id, name').order('name')
      .then(({ data }) => { if (data) setSchools(data) })
  }, [])

  const [child, setChild] = useState<ChildData>({
    fullName: '', nickname: '', dateOfBirth: '', gender: '',
    nationality: '', religion: '', address: '', phoneHome: '', previousSchool: '', schoolId: '',
  })
  const [father, setFather] = useState<ParentData>({
    fullName: '', phoneMobile: '', phoneHome: '', email: '', dateOfBirth: '', employment: '',
  })
  const [mother, setMother] = useState<ParentData>({
    fullName: '', phoneMobile: '', phoneHome: '', email: '', dateOfBirth: '', employment: '',
  })
  const [emergency, setEmergency] = useState<EmergencyData>({
    fullName: '', phoneMobile: '', relationship: '',
  })

  function setC<K extends keyof ChildData>(k: K) { return (v: string) => setChild(p => ({ ...p, [k]: v })) }
  function setF<K extends keyof ParentData>(k: K) { return (v: string) => setFather(p => ({ ...p, [k]: v })) }
  function setM<K extends keyof ParentData>(k: K) { return (v: string) => setMother(p => ({ ...p, [k]: v })) }
  function setE<K extends keyof EmergencyData>(k: K) { return (v: string) => setEmergency(p => ({ ...p, [k]: v })) }

  async function handleNext(e: React.FormEvent) {
    e.preventDefault()
    if (step < 3) {
      setStep(s => s + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Session expired. Please sign in again.')
      setLoading(false)
      return
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .insert({
        parent_id: user.id,
        name: child.fullName,
        nickname: child.nickname || null,
        date_of_birth: child.dateOfBirth || null,
        gender: child.gender || null,
        nationality: child.nationality || null,
        religion: child.religion || null,
        address: child.address || null,
        phone_home: child.phoneHome || null,
        previous_school: child.previousSchool || null,
        school_id: child.schoolId || null,
        status: 'trial' as const,
      })
      .select('id')
      .single()

    if (studentError || !student) {
      setError(studentError?.message ?? 'Failed to save child information.')
      setLoading(false)
      return
    }

    const { error: contactsError } = await supabase.from('student_contacts').insert([
      {
        student_id: student.id,
        type: 'father' as const,
        full_name: father.fullName,
        phone_mobile: father.phoneMobile || null,
        phone_home: father.phoneHome || null,
        email: father.email || null,
        date_of_birth: father.dateOfBirth || null,
        employment: father.employment || null,
        relationship: null,
      },
      {
        student_id: student.id,
        type: 'mother' as const,
        full_name: mother.fullName,
        phone_mobile: mother.phoneMobile || null,
        phone_home: mother.phoneHome || null,
        email: mother.email || null,
        date_of_birth: mother.dateOfBirth || null,
        employment: mother.employment || null,
        relationship: null,
      },
      {
        student_id: student.id,
        type: 'emergency' as const,
        full_name: emergency.fullName,
        phone_mobile: emergency.phoneMobile || null,
        phone_home: null,
        email: null,
        date_of_birth: null,
        employment: null,
        relationship: emergency.relationship || null,
      },
    ])

    if (contactsError) {
      await supabase.from('students').delete().eq('id', student.id)
      setError(contactsError.message)
      setLoading(false)
      return
    }

    window.location.href = '/signup/done'
  }

  const current = STEPS[step]

  return (
    <div className="playtics-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div
          className="px-6 py-5"
          style={{ background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)' }}
        >
          <div className="text-orange-100 text-xs font-medium mb-1">{current.subtitle}</div>
          <div className="text-white text-lg font-bold flex items-center gap-2">
            <span>{current.icon}</span>
            <span>{current.title}</span>
          </div>
          <div className="flex gap-2 mt-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  flex: i <= step ? 2 : 1,
                  background: i <= step ? 'white' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleNext} className="p-6 flex flex-col gap-4">
          {step === 0 && (
            <>
              <FloatingInput id="childName" label="Full Name *" value={child.fullName} onChange={setC('fullName')} required />
              <FloatingInput id="childNick" label="Nickname" value={child.nickname} onChange={setC('nickname')} />
              <FloatingInput id="childDob" label="Date of Birth" type="date" value={child.dateOfBirth} onChange={setC('dateOfBirth')} />
              <FloatingSelect id="childGender" label="Gender" value={child.gender} onChange={setC('gender')} options={['Male', 'Female']} />
              <FloatingInput id="childNat" label="Nationality" value={child.nationality} onChange={setC('nationality')} />
              <FloatingInput id="childRel" label="Religion" value={child.religion} onChange={setC('religion')} />
              <FloatingInput id="childAddr" label="Home Address" value={child.address} onChange={setC('address')} />
              <FloatingInput id="childPhone" label="Home Phone" type="tel" value={child.phoneHome} onChange={setC('phoneHome')} />
              <FloatingInput id="childSchool" label="Previous School" value={child.previousSchool} onChange={setC('previousSchool')} />
              <FloatingSelect
                id="childSchoolId"
                label="School Location *"
                value={child.schoolId}
                onChange={setC('schoolId')}
                options={schools.map(s => ({ value: s.id, label: s.name }))}
              />
            </>
          )}

          {step === 1 && (
            <>
              <FloatingInput id="fatName" label="Full Name *" value={father.fullName} onChange={setF('fullName')} required />
              <FloatingInput id="fatMobile" label="Mobile Phone" type="tel" value={father.phoneMobile} onChange={setF('phoneMobile')} />
              <FloatingInput id="fatHome" label="Home Phone" type="tel" value={father.phoneHome} onChange={setF('phoneHome')} />
              <FloatingInput id="fatEmail" label="Email Address" type="email" value={father.email} onChange={setF('email')} />
              <FloatingInput id="fatDob" label="Date of Birth" type="date" value={father.dateOfBirth} onChange={setF('dateOfBirth')} />
              <FloatingInput id="fatWork" label="Employer / Occupation" value={father.employment} onChange={setF('employment')} />
            </>
          )}

          {step === 2 && (
            <>
              <FloatingInput id="momName" label="Full Name *" value={mother.fullName} onChange={setM('fullName')} required />
              <FloatingInput id="momMobile" label="Mobile Phone" type="tel" value={mother.phoneMobile} onChange={setM('phoneMobile')} />
              <FloatingInput id="momHome" label="Home Phone" type="tel" value={mother.phoneHome} onChange={setM('phoneHome')} />
              <FloatingInput id="momEmail" label="Email Address" type="email" value={mother.email} onChange={setM('email')} />
              <FloatingInput id="momDob" label="Date of Birth" type="date" value={mother.dateOfBirth} onChange={setM('dateOfBirth')} />
              <FloatingInput id="momWork" label="Employer / Occupation" value={mother.employment} onChange={setM('employment')} />
            </>
          )}

          {step === 3 && (
            <>
              <FloatingInput id="emName" label="Full Name *" value={emergency.fullName} onChange={setE('fullName')} required />
              <FloatingInput id="emPhone" label="Mobile Phone *" type="tel" value={emergency.phoneMobile} onChange={setE('phoneMobile')} required />
              <FloatingInput id="emRel" label="Relationship to Child" value={emergency.relationship} onChange={setE('relationship')} />
            </>
          )}

          {error && (
            <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl px-4 py-2">{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full text-white font-semibold py-3 rounded-full mt-2"
            style={{ background: loading ? '#ccc' : 'linear-gradient(135deg, #F59030 0%, #dc6820 100%)' }}
          >
            {loading ? 'Submitting…' : step < 3 ? 'Next' : 'Submit Registration'}
          </button>

          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="w-full text-gray-400 text-sm py-1"
            >
              ← Back
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
