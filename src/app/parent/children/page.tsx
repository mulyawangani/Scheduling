'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParentContext } from '../parent-context'

// ── Types ──────────────────────────────────────────────────────────────────

type StudentProfile = {
  id: string
  name: string
  nickname: string | null
  date_of_birth: string | null
  gender: string | null
  nationality: string | null
  religion: string | null
  address: string | null
  phone_home: string | null
  previous_school: string | null
  photo_url: string | null
  weekly_target_sessions: number
  status: string | null
  school_id: string | null
  therapy_location_id: string | null
  schools: { name: string } | { name: string }[] | null
  therapy_locations: { name: string } | { name: string }[] | null
}

type Extracurricular = {
  id: string
  activity_id: string
  name: string
}

type ExtraRow = {
  id: string
  activity_id: string
  extracurricular_activities: { name: string } | { name: string }[] | null
}

type Draft = {
  name: string
  nickname: string
  date_of_birth: string
  gender: string
  nationality: string
  religion: string
  address: string
  phone_home: string
  previous_school: string
  school_id: string
}

function pickName(s: StudentProfile['schools'] | StudentProfile['therapy_locations']): string | null {
  if (!s) return null
  return Array.isArray(s) ? (s[0]?.name ?? null) : (s as { name: string }).name
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function calcAge(dob: string | null): string | null {
  if (!dob) return null
  const birth = new Date(dob)
  const now = new Date()
  const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (totalMonths < 1) return 'Newborn'
  if (totalMonths < 24) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y} yr ${m} mo` : `${y} year${y !== 1 ? 's' : ''}`
}

// ── Shared field components ────────────────────────────────────────────────

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

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const [focused, setFocused] = useState(false)
  const floated = focused || value.length > 0
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full border-2 rounded-xl px-4 pt-6 pb-2 text-sm outline-none transition-colors bg-white appearance-none"
        style={{
          borderColor: focused ? '#F59030' : '#E5E7EB',
          color: value ? '#1F2937' : 'transparent',
        }}
      >
        <option value="">Select…</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <label
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
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▼</span>
    </div>
  )
}

// ── Read-only row ──────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null }) {
  const display = value?.trim() || null
  return (
    <div className="flex items-start py-2.5 border-b border-gray-50 last:border-0 gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-28 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm" style={{ color: display ? '#1F2937' : '#D1D5DB' }}>
        {display ?? 'Not provided'}
      </span>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({
  title, children, locked,
}: {
  title: string; children: React.ReactNode; locked?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex-1">{title}</p>
        {locked && <span className="text-[10px] text-gray-300 font-medium">Admin only</span>}
      </div>
      <div className="px-4 pb-3 flex flex-col gap-3">{children}</div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ChildrenPage() {
  const { kids, selectedChild } = useParentContext()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  // edit state
  const [editing, setEditing] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [deactivatedAt, setDeactivatedAt] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>({
    name: '', nickname: '', date_of_birth: '', gender: '',
    nationality: '', religion: '', address: '', phone_home: '',
    previous_school: '', school_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // extracurricular state
  const [extracurriculars, setExtracurriculars] = useState<Extracurricular[]>([])
  const [allActivities, setAllActivities] = useState<{ id: string; name: string }[]>([])
  const [addingActivity, setAddingActivity] = useState('')
  const [savingActivity, setSavingActivity] = useState(false)

  // load schools + master activities once (no child dependency)
  useEffect(() => {
    const supabase = createClient()
    supabase.from('schools').select('id, name').order('name')
      .then(({ data }) => { if (data) setSchools(data) })
    supabase.from('extracurricular_activities' as never).select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setAllActivities(data as unknown as { id: string; name: string }[]) })
  }, [])

  // load student/child record + their extracurriculars
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedChild) { setLoading(false); return }
    const supabase = createClient()
    setLoading(true)
    setEditing(false)
    setAddingActivity('')
    Promise.all([
      supabase
        .from('students')
        .select(`
          id, name, nickname, date_of_birth, gender, nationality, religion,
          address, phone_home, previous_school, photo_url,
          weekly_target_sessions, status, school_id, therapy_location_id,
          schools(name), therapy_locations(name)
        `)
        .eq('id', selectedChild.id)
        .single(),
      supabase
        .from('student_extracurriculars' as never)
        .select('id, activity_id, extracurricular_activities(name)')
        .eq('student_id', selectedChild.id),
    ]).then(([{ data: profileData }, { data: rawExtra }]) => {
      setProfile(profileData as StudentProfile | null)
      const extraData = (rawExtra as unknown as ExtraRow[]) ?? []
      setExtracurriculars(
        extraData.map(row => ({
          id: row.id,
          activity_id: row.activity_id,
          name: (Array.isArray(row.extracurricular_activities)
            ? row.extracurricular_activities[0]?.name
            : (row.extracurricular_activities as { name: string } | null)?.name) ?? '',
        }))
      )
      setLoading(false)
    })
  }, [selectedChild?.id])

  function startEdit() {
    if (!profile) return
    setDraft({
      name: profile.name ?? '',
      nickname: profile.nickname ?? '',
      date_of_birth: profile.date_of_birth ?? '',
      gender: profile.gender ?? '',
      nationality: profile.nationality ?? '',
      religion: profile.religion ?? '',
      address: profile.address ?? '',
      phone_home: profile.phone_home ?? '',
      previous_school: profile.previous_school ?? '',
      school_id: profile.school_id ?? '',
    })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function saveEdit() {
    if (!profile || !draft.name.trim()) return
    setSaving(true)
    const supabase = createClient()

    // find updated school name for display
    const newSchool = schools.find(s => s.id === draft.school_id) ?? null

    const { error } = await supabase
      .from('students')
      .update({
        name: draft.name,
        nickname: draft.nickname || null,
        date_of_birth: draft.date_of_birth || null,
        gender: draft.gender || null,
        nationality: draft.nationality || null,
        religion: draft.religion || null,
        address: draft.address || null,
        phone_home: draft.phone_home || null,
        previous_school: draft.previous_school || null,
        school_id: draft.school_id || null,
      })
      .eq('id', profile.id)

    if (!error) {
      setProfile(prev => prev ? {
        ...prev,
        name: draft.name,
        nickname: draft.nickname || null,
        date_of_birth: draft.date_of_birth || null,
        gender: draft.gender || null,
        nationality: draft.nationality || null,
        religion: draft.religion || null,
        address: draft.address || null,
        phone_home: draft.phone_home || null,
        previous_school: draft.previous_school || null,
        school_id: draft.school_id || null,
        schools: newSchool ? { name: newSchool.name } : prev.schools,
      } : prev)
      setEditing(false)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 3000)
    }
    setSaving(false)
  }

  function set(k: keyof Draft) {
    return (v: string) => setDraft(prev => ({ ...prev, [k]: v }))
  }

  async function addExtracurricular() {
    if (!addingActivity || !profile) return
    setSavingActivity(true)
    const supabase = createClient()
    const result = await supabase
      .from('student_extracurriculars' as never)
      .insert({ student_id: profile.id, activity_id: addingActivity })
      .select('id, activity_id, extracurricular_activities(name)')
      .single()
    const { error } = result
    const data = result.data as unknown as ExtraRow | null
    if (!error && data) {
      const name = (Array.isArray(data.extracurricular_activities)
        ? data.extracurricular_activities[0]?.name
        : (data.extracurricular_activities as { name: string } | null)?.name) ?? ''
      setExtracurriculars(prev => [...prev, { id: data.id, activity_id: data.activity_id, name }])
      setAddingActivity('')
    }
    setSavingActivity(false)
  }

  async function removeExtracurricular(id: string) {
    const supabase = createClient()
    await supabase.from('student_extracurriculars' as never).delete().eq('id', id)
    setExtracurriculars(prev => prev.filter(e => e.id !== id))
  }

  async function setInactive() {
    if (!profile) return
    if (!window.confirm(`Set ${profile.name} as inactive? Scheduling will no longer consider them for sessions.`)) return
    setDeactivating(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('students')
      .update({ status: 'inactive' })
      .eq('id', profile.id)
    if (!error) {
      setProfile(prev => prev ? { ...prev, status: 'inactive' } : prev)
      setDeactivatedAt(Date.now())
      setTimeout(() => setDeactivatedAt(null), 3000)
    }
    setDeactivating(false)
  }

  // ── Render guards ──────────────────────────────────────────────────────

  if (!selectedChild || kids.length === 0) {
    return (
      <div className="p-5 text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">👶</p>
        <p className="font-medium text-gray-600">No children linked</p>
        <p className="text-sm mt-1">Children will appear here once enrolled.</p>
      </div>
    )
  }

  if (loading) {
    return <div className="p-5 flex items-center justify-center py-20 text-gray-400 text-sm">Loading…</div>
  }

  if (!profile) {
    return <div className="p-5 text-center py-16 text-sm text-gray-400">Could not load profile.</div>
  }

  const age = calcAge(profile.date_of_birth)
  const school = pickName(profile.schools)
  const therapy = pickName(profile.therapy_locations)

  const STATUS_COLOR: Record<string, string> = {
    student: '#059669', non_student: '#F59030', inactive: '#9CA3AF',
  }
  const STATUS_LABEL: Record<string, string> = {
    student: 'Active', non_student: 'Non-student', inactive: 'Inactive',
  }

  return (
    <div className="p-5 flex flex-col gap-4 pb-8">
      <h2 className="text-lg font-bold text-gray-800">Children Profiles</h2>

      {/* ── Avatar card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div
          className="h-20 flex items-end justify-center"
          style={{ background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)' }}
        >
          <div
            className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center text-3xl translate-y-8 shadow-md overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #FEF3E2 0%, #FCE4ED 100%)' }}
          >
            {profile.photo_url
              ? <img src={profile.photo_url} alt={profile.name} className="w-full h-full object-cover" />
              : '👶'
            }
          </div>
        </div>
        <div className="pt-10 pb-4 px-4 text-center">
          <p className="font-bold text-gray-800 text-lg">{profile.name}</p>
          {profile.nickname && (
            <p className="text-sm text-gray-400 mt-0.5">&ldquo;{profile.nickname}&rdquo;</p>
          )}
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            {age && (
              <span className="text-xs bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full font-medium">{age}</span>
            )}
            {school && (
              <span className="text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full font-medium">📍 {school}</span>
            )}
            {profile.status && (
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{
                  background: `${STATUS_COLOR[profile.status] ?? '#9CA3AF'}18`,
                  color: STATUS_COLOR[profile.status] ?? '#9CA3AF',
                }}
              >
                {STATUS_LABEL[profile.status] ?? profile.status}
              </span>
            )}
          </div>

          {/* Edit / Save / Cancel controls */}
          <div className="mt-4 flex items-center justify-center gap-2 px-2">
            {editing ? (
              <>
                <button
                  onClick={cancelEdit}
                  className="flex-1 py-2.5 rounded-full text-sm font-semibold border-2 border-gray-200 text-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving || !draft.name.trim()}
                  className="flex-[2] py-2.5 rounded-full text-sm font-semibold text-white"
                  style={{
                    background: saving || !draft.name.trim()
                      ? '#ccc'
                      : 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)',
                  }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button
                onClick={startEdit}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold border-2"
                style={{ borderColor: '#F59030', color: '#F59030' }}
              >
                ✏️ Edit Profile
              </button>
            )}
          </div>
          {savedAt && (
            <p className="text-xs text-green-600 font-semibold mt-2">✓ Profile updated</p>
          )}
        </div>
      </div>

      {/* ── Basic Information ── */}
      <Section title="Basic Information">
        {editing ? (
          <>
            <Field label="Full Name *" value={draft.name} onChange={set('name')} />
            <Field label="Nickname" value={draft.nickname} onChange={set('nickname')} />
            <Field label="Date of Birth" value={draft.date_of_birth} onChange={set('date_of_birth')} type="date" />
            <SelectField
              label="Gender"
              value={draft.gender}
              onChange={set('gender')}
              options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]}
            />
          </>
        ) : (
          <>
            <InfoRow label="Full Name" value={profile.name} />
            <InfoRow label="Nickname" value={profile.nickname} />
            <InfoRow label="Date of Birth" value={formatDate(profile.date_of_birth)} />
            <InfoRow label="Age" value={age} />
            <InfoRow label="Gender" value={profile.gender} />
          </>
        )}
      </Section>

      {/* ── Identity ── */}
      <Section title="Identity">
        {editing ? (
          <>
            <Field label="Nationality" value={draft.nationality} onChange={set('nationality')} />
            <Field label="Religion" value={draft.religion} onChange={set('religion')} />
          </>
        ) : (
          <>
            <InfoRow label="Nationality" value={profile.nationality} />
            <InfoRow label="Religion" value={profile.religion} />
          </>
        )}
      </Section>

      {/* ── Contact ── */}
      <Section title="Contact">
        {editing ? (
          <>
            <Field label="Home Phone" value={draft.phone_home} onChange={set('phone_home')} type="tel" />
            <Field label="Home Address" value={draft.address} onChange={set('address')} />
          </>
        ) : (
          <>
            <InfoRow label="Home Phone" value={profile.phone_home} />
            <InfoRow label="Address" value={profile.address} />
          </>
        )}
      </Section>

      {/* ── Education ── */}
      <Section title="Education">
        {editing ? (
          <>
            <SelectField
              label="School Location"
              value={draft.school_id}
              onChange={set('school_id')}
              options={schools.map(s => ({ value: s.id, label: s.name }))}
            />
            <Field label="Previous School" value={draft.previous_school} onChange={set('previous_school')} />
          </>
        ) : (
          <>
            <InfoRow label="Current School" value={school} />
            <InfoRow label="Previous School" value={profile.previous_school} />
          </>
        )}
      </Section>

      {/* ── Therapy ── */}
      <Section title="Therapy">
        <div className="flex items-start py-2.5 border-b border-gray-50 gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-28 shrink-0 mt-0.5">Status</span>
          {profile.status ? (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{
                background: `${STATUS_COLOR[profile.status] ?? '#9CA3AF'}18`,
                color: STATUS_COLOR[profile.status] ?? '#9CA3AF',
              }}
            >
              {STATUS_LABEL[profile.status] ?? profile.status}
            </span>
          ) : (
            <span className="text-sm" style={{ color: '#D1D5DB' }}>Not set</span>
          )}
        </div>
        <div className="flex items-start py-2.5 border-b border-gray-50 gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-28 shrink-0 mt-0.5">Location</span>
          <span className="text-sm flex-1" style={{ color: therapy ? '#1F2937' : '#D1D5DB' }}>{therapy ?? 'Not provided'}</span>
          <span className="text-[10px] text-gray-300 font-medium shrink-0">Admin only</span>
        </div>
        <div className="flex items-start py-2.5 border-b border-gray-50 gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-28 shrink-0 mt-0.5">Weekly Target</span>
          <span className="text-sm flex-1" style={{ color: profile.weekly_target_sessions ? '#1F2937' : '#D1D5DB' }}>
            {profile.weekly_target_sessions
              ? `${profile.weekly_target_sessions} session${profile.weekly_target_sessions !== 1 ? 's' : ''}`
              : 'Not provided'}
          </span>
          <span className="text-[10px] text-gray-300 font-medium shrink-0">Admin only</span>
        </div>
        {profile.status === 'inactive' ? (
          <div className="pt-1 text-center">
            <p className="text-xs text-gray-400 font-medium py-2">
              ⚫ This child is currently inactive
            </p>
            {deactivatedAt && (
              <p className="text-xs text-orange-500 font-semibold">✓ Set to inactive</p>
            )}
          </div>
        ) : (
          <div className="pt-1">
            <button
              onClick={setInactive}
              disabled={deactivating}
              className="w-full py-2.5 rounded-full text-sm font-semibold"
              style={{
                background: '#FFF7ED',
                color: deactivating ? '#9CA3AF' : '#D97706',
                border: '2px solid #FCD34D',
                opacity: deactivating ? 0.7 : 1,
              }}
            >
              {deactivating ? 'Updating…' : '⏸ Set as Inactive'}
            </button>
            {deactivatedAt && (
              <p className="text-xs text-green-600 font-semibold mt-2 text-center">✓ Set to inactive</p>
            )}
          </div>
        )}
      </Section>

      {/* ── Extracurricular Activities ── */}
      {(() => {
        const available = allActivities.filter(a => !extracurriculars.some(e => e.activity_id === a.id))
        return (
          <Section title="Extracurricular Activities">
            {extracurriculars.length === 0 && (
              <p className="text-sm py-1" style={{ color: '#D1D5DB' }}>No activities added yet</p>
            )}
            {extracurriculars.length > 0 && (
              <div className="flex flex-wrap gap-2 py-1">
                {extracurriculars.map(e => (
                  <span
                    key={e.id}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: '#FEF3E2', color: '#F59030' }}
                  >
                    {e.name}
                    <button
                      onClick={() => removeExtracurricular(e.id)}
                      className="leading-none font-bold ml-0.5"
                      style={{ color: '#FCD34D' }}
                      aria-label={`Remove ${e.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {available.length > 0 && (
              <div className="flex gap-2 pt-1">
                <div className="relative flex-1">
                  <select
                    value={addingActivity}
                    onChange={e => setAddingActivity(e.target.value)}
                    className="w-full border-2 rounded-xl px-3 py-2.5 text-sm outline-none bg-white appearance-none"
                    style={{
                      borderColor: addingActivity ? '#F59030' : '#E5E7EB',
                      color: addingActivity ? '#1F2937' : '#9CA3AF',
                    }}
                  >
                    <option value="">Add activity…</option>
                    {available.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▼</span>
                </div>
                <button
                  onClick={addExtracurricular}
                  disabled={!addingActivity || savingActivity}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0"
                  style={{
                    background: !addingActivity || savingActivity
                      ? '#F3F4F6' : 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)',
                    color: !addingActivity || savingActivity ? '#9CA3AF' : 'white',
                  }}
                >
                  {savingActivity ? '…' : '+ Add'}
                </button>
              </div>
            )}
            {available.length === 0 && allActivities.length > 0 && (
              <p className="text-xs text-gray-400 pt-1">All available activities added</p>
            )}
          </Section>
        )
      })()}

      {kids.length > 1 && (
        <p className="text-xs text-gray-400 text-center px-2">
          Switch children using the selector at the top right.
        </p>
      )}
    </div>
  )
}
