'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useParentContext } from '../parent-context'

// ---------- floating-label input ----------
function Field({
  label, value, onChange, type = 'text', readOnly,
}: {
  label: string; value: string; onChange?: (v: string) => void
  type?: string; readOnly?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const floated = focused || value.length > 0
  return (
    <div className="relative">
      <input
        type={type} value={value} readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full border-2 rounded-xl px-4 pt-6 pb-2 text-sm outline-none transition-colors bg-white"
        style={{
          borderColor: readOnly ? '#E5E7EB' : focused ? '#F59030' : '#E5E7EB',
          color: readOnly ? '#9CA3AF' : '#1F2937',
        }}
      />
      <label
        className="absolute pointer-events-none transition-all duration-150"
        style={{
          left: 16, top: floated ? 6 : '50%',
          transform: floated ? 'none' : 'translateY(-50%)',
          fontSize: floated ? 11 : 14,
          color: floated ? (readOnly ? '#9CA3AF' : '#F59030') : '#9CA3AF',
        }}
      >
        {label}
      </label>
    </div>
  )
}

// ---------- read-only display row ----------
function ReadRow({ label, value, empty }: { label: string; value: string; empty?: string }) {
  const display = value.trim() || null
  return (
    <div className="px-4 py-3 border-b border-gray-50 last:border-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm mt-0.5" style={{ color: display ? '#1F2937' : '#D1D5DB' }}>
        {display ?? (empty ?? 'Not set')}
      </p>
    </div>
  )
}

// ---------- contact types ----------
type ContactData = {
  id: string | null
  full_name: string
  phone_mobile: string
  phone_home: string
  email: string
  date_of_birth: string
  employment: string
  relationship: string
}

const EMPTY: ContactData = {
  id: null, full_name: '', phone_mobile: '', phone_home: '',
  email: '', date_of_birth: '', employment: '', relationship: '',
}

type ContactType = 'father' | 'mother' | 'emergency'

// ---------- contact section ----------
function ContactSection({
  type, label, icon, data, onChange, onSave, saving, saved,
}: {
  type: ContactType
  label: string
  icon: string
  data: ContactData
  onChange: (d: ContactData) => void
  onSave: () => void
  saving: boolean
  saved: boolean
}) {
  const [open, setOpen] = useState(false)
  const filled = data.full_name.trim().length > 0

  function set(k: keyof ContactData) {
    return (v: string) => onChange({ ...data, [k]: v })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="text-left">
            <p className="font-semibold text-gray-800 text-sm">{label}</p>
            {filled
              ? <p className="text-xs text-gray-400">{data.full_name}</p>
              : <p className="text-xs text-orange-400">Not filled in yet</p>
            }
          </div>
        </div>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-50">
          <div className="h-2" />
          <Field label="Full Name *" value={data.full_name} onChange={set('full_name')} />
          <Field label="Mobile Phone" value={data.phone_mobile} onChange={set('phone_mobile')} type="tel" />
          {type !== 'emergency' && (
            <>
              <Field label="Home Phone" value={data.phone_home} onChange={set('phone_home')} type="tel" />
              <Field label="Email Address" value={data.email} onChange={set('email')} type="email" />
              <Field label="Date of Birth" value={data.date_of_birth} onChange={set('date_of_birth')} type="date" />
              <Field label="Employer / Occupation" value={data.employment} onChange={set('employment')} />
            </>
          )}
          {type === 'emergency' && (
            <Field label="Relationship to Child" value={data.relationship} onChange={set('relationship')} />
          )}

          <button
            onClick={onSave}
            disabled={saving || !data.full_name.trim()}
            className="w-full py-3 rounded-full text-sm font-semibold text-white mt-1"
            style={{
              background: saving || !data.full_name.trim()
                ? '#ccc'
                : 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- main page ----------
export default function ProfilePage() {
  const { selectedChild } = useParentContext()

  // account
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [editingAccount, setEditingAccount] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftPhone, setDraftPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savedProfile, setSavedProfile] = useState(false)

  // password
  const [pwOpen, setPwOpen] = useState(false)
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)

  // contacts
  const [father, setFather] = useState<ContactData>(EMPTY)
  const [mother, setMother] = useState<ContactData>(EMPTY)
  const [emergency, setEmergency] = useState<ContactData>(EMPTY)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<ContactType | null>(null)
  const [saved, setSaved] = useState<ContactType | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      setLoading(true)
      setFather(EMPTY); setMother(EMPTY); setEmergency(EMPTY)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: prof } = await supabase
        .from('profiles').select('name, phone').eq('id', user.id).single()
      setProfileName(prof?.name ?? '')
      setProfilePhone(prof?.phone ?? '')
      setProfileEmail(user.email ?? '')

      if (selectedChild) {
        const { data: contacts } = await supabase
          .from('student_contacts').select('*').eq('student_id', selectedChild.id)
        for (const c of contacts ?? []) {
          const d: ContactData = {
            id: c.id,
            full_name: c.full_name ?? '',
            phone_mobile: c.phone_mobile ?? '',
            phone_home: c.phone_home ?? '',
            email: c.email ?? '',
            date_of_birth: c.date_of_birth ?? '',
            employment: c.employment ?? '',
            relationship: c.relationship ?? '',
          }
          if (c.type === 'father') setFather(d)
          else if (c.type === 'mother') setMother(d)
          else if (c.type === 'emergency') setEmergency(d)
        }
      }
      setLoading(false)
    }
    load()
  }, [selectedChild?.id])

  function startEdit() {
    setDraftName(profileName)
    setDraftPhone(profilePhone)
    setEditingAccount(true)
  }

  async function saveProfile() {
    setSavingProfile(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles')
        .update({ name: draftName, phone: draftPhone || null })
        .eq('id', user.id)
      setProfileName(draftName)
      setProfilePhone(draftPhone)
    }
    setSavingProfile(false)
    setSavedProfile(true)
    setEditingAccount(false)
    setTimeout(() => setSavedProfile(false), 3000)
  }

  async function changePassword() {
    setPwError('')
    if (!pwNew.trim()) { setPwError('Enter a new password.'); return }
    if (pwNew.length < 6) { setPwError('Password must be at least 6 characters.'); return }
    if (pwNew !== pwConfirm) { setPwError('Passwords do not match.'); return }
    setPwSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pwNew })
    setPwSaving(false)
    if (error) {
      setPwError(error.message)
    } else {
      setPwNew(''); setPwConfirm('')
      setPwSaved(true); setPwOpen(false)
      setTimeout(() => setPwSaved(false), 4000)
    }
  }

  async function saveContact(type: ContactType, data: ContactData) {
    if (!selectedChild || !data.full_name.trim()) return
    setSaving(type)
    const supabase = createClient()

    if (data.id) {
      await supabase.from('student_contacts').update({
        full_name: data.full_name,
        phone_mobile: data.phone_mobile || null,
        phone_home: data.phone_home || null,
        email: data.email || null,
        date_of_birth: data.date_of_birth || null,
        employment: data.employment || null,
        relationship: data.relationship || null,
      }).eq('id', data.id)
    } else {
      const { data: ins } = await supabase.from('student_contacts').insert({
        student_id: selectedChild.id,
        type,
        full_name: data.full_name,
        phone_mobile: data.phone_mobile || null,
        phone_home: data.phone_home || null,
        email: data.email || null,
        date_of_birth: data.date_of_birth || null,
        employment: data.employment || null,
        relationship: data.relationship || null,
      }).select('id').single()
      if (ins) {
        const withId = (prev: ContactData) => ({ ...prev, id: ins.id })
        if (type === 'father') setFather(withId)
        else if (type === 'mother') setMother(withId)
        else if (type === 'emergency') setEmergency(withId)
      }
    }

    setSaving(null)
    setSaved(type)
    setTimeout(() => setSaved(null), 2000)
  }

  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center py-20 text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="p-5 flex flex-col gap-4 pb-8">
      <h2 className="text-lg font-bold text-gray-800">My Profile</h2>

      {/* ── Account card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div
          className="h-16 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)' }}
        >
          <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center text-2xl">👤</div>
        </div>

        {editingAccount ? (
          <div className="px-4 py-4 flex flex-col gap-3">
            <Field label="Display Name" value={draftName} onChange={setDraftName} />
            <Field label="Login Username" value={profileEmail} readOnly />
            <Field label="Primary WA Number" value={draftPhone} onChange={setDraftPhone} type="tel" />
            <p className="text-[11px] text-gray-400 px-1 -mt-1">
              📲 We&apos;ll send session reminders &amp; notifications to this number.
            </p>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setEditingAccount(false)}
                className="flex-1 py-3 rounded-full text-sm font-semibold border-2 border-gray-200 text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="flex-[2] py-3 rounded-full text-sm font-semibold text-white"
                style={{
                  background: savingProfile ? '#ccc' : 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)',
                }}
              >
                {savingProfile ? 'Saving…' : 'Save Account'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <ReadRow label="Display Name" value={profileName} empty="Not set" />
            <ReadRow label="Login Username" value={profileEmail} />
            <ReadRow
              label="Primary WA Number"
              value={profilePhone}
              empty="Not set — add to receive reminders"
            />
            <div className="px-4 pb-4 pt-3 flex items-center gap-3">
              <button
                onClick={startEdit}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold border-2"
                style={{ borderColor: '#F59030', color: '#F59030' }}
              >
                ✏️ Edit Account
              </button>
              {savedProfile && (
                <span className="text-xs text-green-600 font-semibold">✓ Saved</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Change Password card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => { setPwOpen(o => !o); setPwError('') }}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Change Password</p>
              {pwSaved
                ? <p className="text-xs text-green-500">✓ Password updated successfully</p>
                : <p className="text-xs text-gray-400">Update your login password</p>
              }
            </div>
          </div>
          <span className="text-gray-400 text-sm">{pwOpen ? '▲' : '▼'}</span>
        </button>

        {pwOpen && (
          <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-50">
            <div className="h-2" />
            <Field label="New Password" value={pwNew} onChange={setPwNew} type="password" />
            <Field label="Confirm New Password" value={pwConfirm} onChange={setPwConfirm} type="password" />
            {pwError && <p className="text-xs text-red-500 px-1">{pwError}</p>}
            <button
              onClick={changePassword}
              disabled={pwSaving}
              className="w-full py-3 rounded-full text-sm font-semibold text-white mt-1"
              style={{
                background: pwSaving ? '#ccc' : 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)',
              }}
            >
              {pwSaving ? 'Updating…' : 'Change Password'}
            </button>
          </div>
        )}
      </div>

      {/* ── Contacts ── */}
      {selectedChild ? (
        <>
          <p className="text-xs text-gray-400 font-medium tracking-wide uppercase px-1">
            Contacts for {selectedChild.nickname ?? selectedChild.name}
          </p>

          <ContactSection
            type="father" label="Father" icon="👨"
            data={father} onChange={setFather}
            onSave={() => saveContact('father', father)}
            saving={saving === 'father'} saved={saved === 'father'}
          />
          <ContactSection
            type="mother" label="Mother" icon="👩"
            data={mother} onChange={setMother}
            onSave={() => saveContact('mother', mother)}
            saving={saving === 'mother'} saved={saved === 'mother'}
          />
          <ContactSection
            type="emergency" label="Emergency Contact" icon="🚨"
            data={emergency} onChange={setEmergency}
            onSave={() => saveContact('emergency', emergency)}
            saving={saving === 'emergency'} saved={saved === 'emergency'}
          />
        </>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">
          Add a child first to manage contacts.{' '}
          <Link href="/parent/children/new" className="font-semibold" style={{ color: '#F59030' }}>+ Add child</Link>
        </p>
      )}

      {/* ── Logout ── */}
      <div className="mt-2">
        <a
          href="/api/auth/signout"
          onClick={async e => {
            e.preventDefault()
            await createClient().auth.signOut()
            window.location.href = '/login'
          }}
          className="text-sm text-gray-400 underline"
        >
          Log out
        </a>
      </div>
    </div>
  )
}
