/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/back-link'
import { requireCapability } from '@/lib/auth/require-capability'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, { text: string; bg: string; label: string }> = {
  PUBLISHED: { text: '#2FA56F', bg: '#2FA56F18', label: 'Published' },
  SCHEDULED: { text: '#3B82F6', bg: '#3B82F618', label: 'Scheduled' },
  DRAFT:     { text: '#9CA3AF', bg: '#9CA3AF18', label: 'Draft' },
}

export default async function AnnouncementsPage() {
  await requireCapability('ops.announcements')
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: announcements } = await db
    .from('announcements')
    .select(`
      id, title, body, status, target_type, published_at, created_at,
      author:profiles!announcements_author_id_fkey(name),
      target_classroom:classrooms!announcements_target_classroom_id_fkey(name)
    `)
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin" label="Dashboard" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Announcements</h1>
          <p className="text-xs text-gray-400 mt-0.5">Publish messages to all parents or specific classrooms.</p>
        </div>
        <Link
          href="/admin/announcements/new"
          className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
          style={{ background: 'linear-gradient(135deg, #F59030, #DC2870)' }}
        >
          + New
        </Link>
      </div>

      {!announcements || announcements.length === 0 ? (
        <p className="text-sm text-gray-500">No announcements yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {announcements.map((a: any) => {
            const style = STATUS_STYLES[a.status] ?? STATUS_STYLES.DRAFT
            const authorName = Array.isArray(a.author) ? a.author[0]?.name : a.author?.name
            const classroomName = Array.isArray(a.target_classroom)
              ? a.target_classroom[0]?.name
              : a.target_classroom?.name
            return (
              <li
                key={a.id}
                className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex flex-col gap-1.5"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: style.text, background: style.bg }}
                  >
                    {style.label}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {a.target_type === 'ALL' ? 'All parents' : classroomName ? `Classroom: ${classroomName}` : 'Classroom'}
                  </span>
                </div>
                <div className="text-sm font-semibold text-gray-900">{a.title}</div>
                <p className="text-xs text-gray-500 line-clamp-2">{a.body}</p>
                <div className="text-[10px] text-gray-400">
                  By {authorName ?? 'Unknown'} ·{' '}
                  {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
