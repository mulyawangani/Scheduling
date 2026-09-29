import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { createClient } from '@/lib/supabase/server'
import { ParentProvider, type ChildInfo } from './parent-context'
import { ParentHeader } from './parent-header'
import { ParentNav } from './parent-nav'

export const dynamic = 'force-dynamic'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const result = await getUserProfile()
  if (!result) redirect('/login')
  if (result.profile.role !== 'parent') redirect('/')

  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('students')
    .select('id, name, nickname, schools(name)')
    .eq('parent_id', result.user.id)
    .order('created_at', { ascending: true })

  const kids: ChildInfo[] = (rows ?? []).map(r => ({
    id: r.id,
    name: r.name,
    nickname: r.nickname ?? null,
    schoolName: (Array.isArray(r.schools) ? r.schools[0]?.name : (r.schools as { name: string } | null)?.name) ?? null,
  }))

  return (
    <ParentProvider kids={kids}>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <ParentHeader />
        <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
          {children}
        </main>
        <ParentNav />
      </div>
    </ParentProvider>
  )
}
