import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'

export async function POST(req: NextRequest) {
  const result = await getUserProfile()
  if (!result || result.profile.role !== 'nanny') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const profile = result.profile

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const classroomId = formData.get('classroomId') as string | null
  const caption = formData.get('caption') as string | null

  if (!file || !classroomId) {
    return NextResponse.json({ error: 'file and classroomId are required' }, { status: 400 })
  }

  // Get school_id from classroom
  const { data: classroom } = await db.from('classrooms').select('school_id').eq('id', classroomId).single()
  if (!classroom?.school_id) {
    return NextResponse.json({ error: 'Classroom not found' }, { status: 404 })
  }

  // Upload to Supabase Storage
  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${classroom.school_id}/${classroomId}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await db.storage
    .from('classroom-photos')
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = db.storage.from('classroom-photos').getPublicUrl(storagePath)

  // Insert record
  const { data: photo, error: insertError } = await db
    .from('classroom_photos')
    .insert({
      school_id:    classroom.school_id,
      classroom_id: classroomId,
      uploaded_by:  profile.id,
      photo_url:    publicUrl,
      caption:      caption || null,
      status:       'DRAFT',
    })
    .select(`
      id, photo_url, caption, status, created_at, published_at, classroom_id,
      classrooms!classroom_photos_classroom_id_fkey(name),
      profiles!classroom_photos_uploaded_by_fkey(name)
    `)
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    id: photo.id,
    photoUrl: photo.photo_url,
    caption: photo.caption,
    status: photo.status,
    createdAt: photo.created_at,
    publishedAt: photo.published_at,
    classroomId: photo.classroom_id,
    classroom: { name: Array.isArray(photo.classrooms) ? photo.classrooms[0]?.name : photo.classrooms?.name },
    uploadedBy: { name: Array.isArray(photo.profiles) ? photo.profiles[0]?.name : photo.profiles?.name },
  })
}

export async function GET() {
  const result = await getUserProfile()
  if (!result || !['nanny', 'owner', 'admin'].includes(result.profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any

  const { data, error } = await db
    .from('classroom_photos')
    .select(`
      id, photo_url, caption, status, created_at, published_at, classroom_id,
      classrooms!classroom_photos_classroom_id_fkey(name),
      profiles!classroom_photos_uploaded_by_fkey(name)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photos = (data ?? []).map((p: any) => ({
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

  return NextResponse.json(photos)
}
