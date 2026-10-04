import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const profile = await getUserProfile()
  if (!profile || !['nanny', 'owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any
  const { status } = await req.json()

  if (!['DRAFT', 'PUBLISHED'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data, error } = await db
    .from('classroom_photos')
    .update({
      status,
      published_at: status === 'PUBLISHED' ? new Date().toISOString() : null,
    })
    .eq('id', params.id)
    .select(`
      id, photo_url, caption, status, created_at, published_at, classroom_id,
      classrooms!classroom_photos_classroom_id_fkey(name),
      profiles!classroom_photos_uploaded_by_fkey(name)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    id: data.id,
    photoUrl: data.photo_url,
    caption: data.caption,
    status: data.status,
    createdAt: data.created_at,
    publishedAt: data.published_at,
    classroomId: data.classroom_id,
    classroom: { name: Array.isArray(data.classrooms) ? data.classrooms[0]?.name : data.classrooms?.name },
    uploadedBy: { name: Array.isArray(data.profiles) ? data.profiles[0]?.name : data.profiles?.name },
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const profile = await getUserProfile()
  if (!profile || !['nanny', 'owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any

  const { data: photo } = await db
    .from('classroom_photos')
    .select('photo_url')
    .eq('id', params.id)
    .single()

  const { error } = await db.from('classroom_photos').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Delete from storage (best-effort)
  if (photo?.photo_url) {
    const url = new URL(photo.photo_url)
    const storagePath = url.pathname.split('/object/public/classroom-photos/')[1]
    if (storagePath) {
      await db.storage.from('classroom-photos').remove([storagePath])
    }
  }

  return NextResponse.json({ ok: true })
}
