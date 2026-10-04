/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { requireNanny } from '@/lib/auth/require-nanny'
import NannyPhotoGallery from './NannyPhotoGallery'

export const dynamic = 'force-dynamic'

export default async function NannyPhotosPage() {
  await requireNanny()
  const db = (await createClient()) as any

  const [{ data: classrooms }, { data: photosRaw }] = await Promise.all([
    db.from('classrooms').select('id, name').eq('active', true).order('name'),
    db.from('classroom_photos')
      .select(`
        id, photo_url, caption, status, created_at, published_at, classroom_id,
        classrooms!classroom_photos_classroom_id_fkey(name),
        profiles!classroom_photos_uploaded_by_fkey(name)
      `)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const photos = (photosRaw ?? []).map((p: any) => ({
    id: p.id,
    photoUrl: p.photo_url,
    caption: p.caption,
    status: p.status,
    createdAt: p.created_at,
    publishedAt: p.published_at,
    classroomId: p.classroom_id,
    classroom: { name: Array.isArray(p.classrooms) ? p.classrooms[0]?.name : p.classrooms?.name },
    uploadedBy: { name: Array.isArray(p.profiles) ? p.profiles[0]?.name : p.profiles?.name },
  }))

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ paddingTop: 4, paddingBottom: 28 }}>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Classroom</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Photo Gallery</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload and share classroom moments with parents.</p>
      </div>
      <NannyPhotoGallery classrooms={classrooms ?? []} initialPhotos={photos} />
    </div>
  )
}
