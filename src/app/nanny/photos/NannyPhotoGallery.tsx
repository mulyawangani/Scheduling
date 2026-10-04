'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Classroom = { id: string; name: string }
type Photo = {
  id: string
  photoUrl: string
  caption: string | null
  status: string
  createdAt: string
  publishedAt: string | null
  classroomId: string
  classroom: { name: string }
  uploadedBy: { name: string }
}

export default function NannyPhotoGallery({
  classrooms,
  initialPhotos,
}: {
  classrooms: Classroom[]
  initialPhotos: Photo[]
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [photos, setPhotos]             = useState<Photo[]>(initialPhotos)
  const [filter, setFilter]             = useState<'ALL' | 'DRAFT' | 'PUBLISHED'>('ALL')
  const [uploading, setUploading]       = useState(false)
  const [uploadError, setUploadError]   = useState('')
  const [classroomId, setClassroomId]   = useState(classrooms[0]?.id ?? '')
  const [caption, setCaption]           = useState('')
  const [preview, setPreview]           = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const filtered = photos.filter(p => filter === 'ALL' || p.status === filter)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
    setUploadError('')
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile || !classroomId) return
    setUploading(true)
    setUploadError('')

    const fd = new FormData()
    fd.append('file', selectedFile)
    fd.append('classroomId', classroomId)
    if (caption) fd.append('caption', caption)

    const res = await fetch('/api/nanny/photos', { method: 'POST', body: fd })
    setUploading(false)

    if (!res.ok) {
      const d = await res.json()
      setUploadError(d.error ?? 'Upload failed')
      return
    }

    const newPhoto = await res.json()
    setPhotos(prev => [newPhoto, ...prev])
    setSelectedFile(null)
    setCaption('')
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    router.refresh()
  }

  async function handlePublishToggle(photo: Photo) {
    const newStatus = photo.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    const res = await fetch(`/api/nanny/photos/${photo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPhotos(prev => prev.map(p => p.id === photo.id ? updated : p))
    }
  }

  async function handleDelete(photoId: string) {
    if (!confirm('Delete this photo permanently?')) return
    const res = await fetch(`/api/nanny/photos/${photoId}`, { method: 'DELETE' })
    if (res.ok) setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Upload form */}
      <div style={{ background: '#fff', border: '1px solid #F3F4F6', borderRadius: 20, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <h2 style={{ fontWeight: 700, fontSize: 16, color: '#111827', margin: '0 0 16px' }}>Upload Photo</h2>
        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Classroom</label>
              <select
                value={classroomId}
                onChange={e => setClassroomId(e.target.value)}
                required
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 12, padding: '8px 12px', fontSize: 13 }}
              >
                {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Caption (optional)</label>
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="e.g. Morning circle time"
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 12, padding: '8px 12px', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Photo</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${preview ? '#E5E7EB' : '#16ABE3'}`,
                borderRadius: 14, padding: 18, textAlign: 'center', cursor: 'pointer',
                background: '#F9FAFB', transition: 'border-color .15s',
              }}
            >
              {preview ? (
                <div>
                  <img src={preview} alt="preview" style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 10, objectFit: 'cover' }} />
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>{selectedFile?.name}</div>
                </div>
              ) : (
                <div style={{ color: '#9CA3AF' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16ABE3" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8 }}>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                  </svg>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#16ABE3' }}>Click to choose a photo</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>JPG, PNG, WEBP — max 10 MB</div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>

          {uploadError && (
            <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px' }}>
              {uploadError}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !selectedFile || !classroomId}
            style={{
              padding: '12px', borderRadius: 14, fontWeight: 700, fontSize: 14,
              background: '#F59030', color: '#fff', border: 'none', cursor: 'pointer',
              opacity: (uploading || !selectedFile) ? 0.45 : 1,
            }}
          >
            {uploading ? 'Uploading…' : 'Upload Photo'}
          </button>
        </form>
      </div>

      {/* Gallery */}
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['ALL', 'DRAFT', 'PUBLISHED'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: filter === f ? '#16ABE3' : '#fff',
              color: filter === f ? '#fff' : '#6B7280',
              outline: filter === f ? 'none' : '1px solid #E5E7EB',
            }}>
              {f === 'ALL' ? `All (${photos.length})` : f === 'DRAFT' ? `Drafts (${photos.filter(p => p.status === 'DRAFT').length})` : `Published (${photos.filter(p => p.status === 'PUBLISHED').length})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-16 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <p className="font-semibold text-gray-700">No photos yet</p>
            <p className="text-sm text-gray-400">Upload photos above to share classroom moments.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {filtered.map(photo => (
              <div key={photo.id} style={{ background: '#fff', border: '1px solid #F3F4F6', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ position: 'relative', aspectRatio: '4/3', background: '#F9FAFB' }}>
                  <img src={photo.photoUrl} alt={photo.caption ?? 'Classroom photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: photo.status === 'PUBLISHED' ? '#16ABE3' : 'rgba(0,0,0,.55)',
                    color: '#fff',
                  }}>
                    {photo.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                  </div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  {photo.caption && <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 4px', lineHeight: 1.4 }}>{photo.caption}</p>}
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 2px' }}>{photo.classroom.name}</p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                    {new Date(photo.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
                  <button
                    onClick={() => handlePublishToggle(photo)}
                    style={{
                      flex: 1, padding: 8, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: photo.status === 'PUBLISHED' ? '#FFFBEB' : '#EFF6FF',
                      color: photo.status === 'PUBLISHED' ? '#D97706' : '#1D4ED8',
                      outline: '1px solid ' + (photo.status === 'PUBLISHED' ? '#FDE68A' : '#BFDBFE'),
                    }}
                  >
                    {photo.status === 'PUBLISHED' ? 'Unpublish' : 'Publish to Parents'}
                  </button>
                  <button
                    onClick={() => handleDelete(photo.id)}
                    style={{
                      width: 36, height: 36, borderRadius: 10, border: 'none',
                      background: '#FFF1F2', color: '#E11D48', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      outline: '1px solid #FECDD3',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
