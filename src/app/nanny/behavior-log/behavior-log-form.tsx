'use client'

import { useState } from 'react'
import { addBehaviorLog } from './actions'
import { BEHAVIOR_CATEGORIES } from '@/lib/behaviorCategories'

const AVATAR_PALETTE = ['#16ABE3', '#2FA56F', '#E0930B', '#8B6CE6', '#E0567E', '#4EA8DE', '#60C97A', '#F4A261']
function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

type Student = { id: string; name: string; classroom: string | null }
type Teacher = { id: string; name: string }

export function BehaviorLogForm({ students, teachers }: { students: Student[]; teachers: Teacher[] }) {
  const [studentId, setStudentId]         = useState('')
  const [selectedType, setSelectedType]   = useState<string>('')
  const [selectedActivity, setActivity]   = useState<string>('')
  const [selectedSub, setSub]             = useState<string>('')
  const [otherStudentId, setOtherStudent] = useState<string>('')
  const [otherTeacherId, setOtherTeacher] = useState<string>('')
  const [note, setNote]                   = useState('')
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  const types = [...new Set(BEHAVIOR_CATEGORIES.map(c => c.type))]
  const activitiesForType = BEHAVIOR_CATEGORIES.filter(c => c.type === selectedType)
  const selectedCat = BEHAVIOR_CATEGORIES.find(c => c.type === selectedType && c.activity === selectedActivity)

  function reset() {
    setStudentId(''); setSelectedType(''); setActivity(''); setSub('')
    setOtherStudent(''); setOtherTeacher(''); setNote('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!studentId || !selectedType || !selectedActivity) return
    setSaving(true)
    setError(null)
    try {
      const result = await addBehaviorLog({
        studentId,
        type: selectedType,
        activity: selectedActivity,
        subActivity: selectedSub || undefined,
        otherStudentId: otherStudentId || undefined,
        otherTeacherId: otherTeacherId || undefined,
        note: note || undefined,
      })
      if (result?.error) {
        setError(result.error)
        return
      }
      setSaved(true)
      reset()
      setTimeout(() => setSaved(false), 1500)
    } catch {
      setError('Something went wrong. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #F3F4F6', borderRadius: 20, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <h2 style={{ fontWeight: 700, fontSize: 16, color: '#111827', margin: '0 0 16px' }}>Record Behavior</h2>

      {students.length === 0 ? (
        <p style={{ fontSize: 13, color: '#C77F05', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 16px' }}>
          No checked-in students today. Students must be checked in before logging behavior.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Student card picker */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 10 }}>Student</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 10 }}>
              {students.map(s => {
                const selected = studentId === s.id
                const color = avatarColor(s.name)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setStudentId(s.id); setOtherStudent(''); setOtherTeacher('') }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 6, padding: '10px 6px', borderRadius: 14, cursor: 'pointer',
                      border: selected ? `2px solid ${color}` : '2px solid #F3F4F6',
                      background: selected ? `${color}18` : '#F9FAFB',
                      boxShadow: selected ? `0 0 0 3px ${color}30` : 'none',
                      transition: 'all .14s', position: 'relative',
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: '50%', background: color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 18, color: '#fff', flexShrink: 0,
                      }}>
                        {initials(s.name)}
                      </div>
                      {selected && (
                        <div style={{
                          position: 'absolute', bottom: -2, right: -2,
                          width: 18, height: 18, borderRadius: '50%',
                          background: color, border: '2px solid #fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: selected ? 700 : 500,
                      color: selected ? '#111827' : '#6B7280',
                      textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-word', maxWidth: '100%',
                    }}>
                      {s.name.split(' ')[0]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category toggle */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Category</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {types.map(t => {
                const active = selectedType === t
                const accent = t === 'behavior' ? '#E0567E' : '#3B82F6'
                return (
                  <button key={t} type="button"
                    onClick={() => { setSelectedType(t); setActivity(''); setSub('') }}
                    style={{
                      flex: 1, padding: 10, fontSize: 13, fontWeight: 600,
                      borderRadius: 12, cursor: 'pointer', border: 'none',
                      background: active ? accent : '#F9FAFB',
                      color: active ? '#fff' : '#6B7280',
                      outline: active ? 'none' : '1px solid #E5E7EB',
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Activity list */}
          {selectedType && (
            <div style={{
              borderRadius: 12, border: '1px solid #E5E7EB', padding: '12px 14px',
              background: selectedType === 'behavior' ? '#FFF0F5' : '#EFF6FF',
            }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Activity</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activitiesForType.map(cat => (
                  <label key={cat.activity} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input type="radio" name="activity" value={cat.activity}
                      checked={selectedActivity === cat.activity}
                      onChange={() => { setActivity(cat.activity); setSub(''); setOtherStudent(''); setOtherTeacher('') }}
                      style={{ marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: '#374151' }}>{cat.activity}</span>
                    {cat.otherInfo && (
                      <span style={{ fontSize: 10, background: '#F3F4F6', color: '#9CA3AF', padding: '1px 6px', borderRadius: 6, marginLeft: 'auto', flexShrink: 0 }}>
                        involves {cat.otherInfo === 'students' ? 'other student' : 'teacher'}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Sub-activities */}
          {selectedCat && selectedCat.subActivities.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Specific action</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selectedCat.subActivities.map(sub => (
                  <button key={sub} type="button" onClick={() => setSub(sub)} style={{
                    padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', border: 'none',
                    background: selectedSub === sub ? '#111827' : '#F9FAFB',
                    color: selectedSub === sub ? '#fff' : '#6B7280',
                    outline: selectedSub === sub ? 'none' : '1px solid #E5E7EB',
                  }}>{sub}</button>
                ))}
              </div>
            </div>
          )}

          {/* Other student card picker */}
          {selectedCat?.otherInfo === 'students' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Other student involved</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 10 }}>
                {students.filter(s => s.id !== studentId).map(s => {
                  const sel = otherStudentId === s.id
                  const col = avatarColor(s.name)
                  return (
                    <button key={s.id} type="button"
                      onClick={() => setOtherStudent(sel ? '' : s.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 6, padding: '10px 6px', borderRadius: 14, cursor: 'pointer',
                        border: sel ? `2px solid ${col}` : '2px solid #F3F4F6',
                        background: sel ? `${col}18` : '#F9FAFB',
                        transition: 'all .14s',
                      }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: '#fff' }}>
                        {initials(s.name)}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: sel ? 700 : 500, textAlign: 'center', color: sel ? '#111827' : '#6B7280', lineHeight: 1.3, wordBreak: 'break-word', maxWidth: '100%' }}>
                        {s.name.split(' ')[0]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Teacher involved card picker */}
          {selectedCat?.otherInfo === 'teacher' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Teacher involved</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 10 }}>
                {teachers.map(t => {
                  const sel = otherTeacherId === t.id
                  const col = avatarColor(t.name)
                  return (
                    <button key={t.id} type="button"
                      onClick={() => setOtherTeacher(sel ? '' : t.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 6, padding: '10px 6px', borderRadius: 14, cursor: 'pointer',
                        border: sel ? `2px solid ${col}` : '2px solid #F3F4F6',
                        background: sel ? `${col}18` : '#F9FAFB',
                        transition: 'all .14s',
                      }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: '#fff' }}>
                        {initials(t.name)}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: sel ? 700 : 500, textAlign: 'center', color: sel ? '#111827' : '#6B7280', lineHeight: 1.3, wordBreak: 'break-word', maxWidth: '100%' }}>
                        {t.name.split(' ').slice(0, 2).join(' ')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Any additional details…"
              style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 12, padding: '8px 12px', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px' }}>
              Couldn&apos;t save: {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !studentId || !selectedType || !selectedActivity}
            style={{
              padding: '12px', borderRadius: 14, fontWeight: 700, fontSize: 14,
              background: '#F59030', color: '#fff', border: 'none', cursor: 'pointer',
              opacity: (saving || !studentId || !selectedType || !selectedActivity) ? 0.45 : 1,
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Record Behavior'}
          </button>
        </form>
      )}
    </div>
  )
}
