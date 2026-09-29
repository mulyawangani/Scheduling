'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParentContext } from '../parent-context'

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
  schools: { name: string } | { name: string }[] | null
  therapy_locations: { name: string } | { name: string }[] | null
}

function schoolName(s: StudentProfile['schools']): string | null {
  if (!s) return null
  return Array.isArray(s) ? (s[0]?.name ?? null) : s.name
}

function therapyName(t: StudentProfile['therapy_locations']): string | null {
  if (!t) return null
  return Array.isArray(t) ? (t[0]?.name ?? null) : t.name
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 pt-3 pb-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
      </div>
      <div className="px-4 pb-2">{children}</div>
    </div>
  )
}

export default function ChildrenPage() {
  const { kids, selectedChild } = useParentContext()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selectedChild) { setLoading(false); return }
    const supabase = createClient()
    setLoading(true)
    supabase
      .from('students')
      .select(`
        id, name, nickname, date_of_birth, gender, nationality, religion,
        address, phone_home, previous_school, photo_url, weekly_target_sessions, status,
        schools(name),
        therapy_locations(name)
      `)
      .eq('id', selectedChild.id)
      .single()
      .then(({ data }) => {
        setProfile(data as StudentProfile | null)
        setLoading(false)
      })
  }, [selectedChild?.id])

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
  const school = schoolName(profile.schools)
  const therapy = therapyName(profile.therapy_locations)

  const statusColor: Record<string, string> = {
    student: '#059669',
    non_student: '#F59030',
    inactive: '#9CA3AF',
  }
  const statusLabel: Record<string, string> = {
    student: 'Active',
    non_student: 'Non-student',
    inactive: 'Inactive',
  }

  return (
    <div className="p-5 flex flex-col gap-4 pb-8">
      <h2 className="text-lg font-bold text-gray-800">Children Profiles</h2>

      {/* Avatar card */}
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
            <p className="text-sm text-gray-400 mt-0.5">"{profile.nickname}"</p>
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
                  background: `${statusColor[profile.status] ?? '#9CA3AF'}18`,
                  color: statusColor[profile.status] ?? '#9CA3AF',
                }}
              >
                {statusLabel[profile.status] ?? profile.status}
              </span>
            )}
          </div>
        </div>
      </div>

      <Section title="Basic Information">
        <InfoRow label="Full Name" value={profile.name} />
        <InfoRow label="Nickname" value={profile.nickname} />
        <InfoRow label="Date of Birth" value={formatDate(profile.date_of_birth)} />
        <InfoRow label="Age" value={age} />
        <InfoRow label="Gender" value={profile.gender} />
      </Section>

      <Section title="Identity">
        <InfoRow label="Nationality" value={profile.nationality} />
        <InfoRow label="Religion" value={profile.religion} />
      </Section>

      <Section title="Contact">
        <InfoRow label="Home Phone" value={profile.phone_home} />
        <InfoRow label="Address" value={profile.address} />
      </Section>

      <Section title="Education">
        <InfoRow label="Current School" value={school} />
        <InfoRow label="Previous School" value={profile.previous_school} />
      </Section>

      <Section title="Therapy">
        <InfoRow label="Location" value={therapy} />
        <InfoRow
          label="Weekly Target"
          value={profile.weekly_target_sessions
            ? `${profile.weekly_target_sessions} session${profile.weekly_target_sessions !== 1 ? 's' : ''}`
            : null}
        />
      </Section>

      {kids.length > 1 && (
        <p className="text-xs text-gray-400 text-center px-2">
          Switch children using the selector at the top right.
        </p>
      )}
    </div>
  )
}
