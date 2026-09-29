import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { LogoutButton } from '@/components/logout-button'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const result = await getUserProfile()
  if (!result) redirect('/login')
  if (result.profile.role !== 'parent') redirect('/')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', result.user.id)
    .single()

  return (
    <div className="p-5 flex flex-col gap-6">
      <h2 className="text-lg font-bold text-gray-800">My Profile</h2>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div
          className="h-20 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)' }}
        >
          <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center text-3xl">
            👤
          </div>
        </div>
        <div className="px-5 py-4 flex flex-col gap-2">
          <p className="text-lg font-bold text-gray-800">{profile?.name ?? '—'}</p>
          <p className="text-sm text-gray-500">{profile?.email ?? result.user.email ?? '—'}</p>
        </div>
      </div>

      <div className="mt-4">
        <LogoutButton />
      </div>
    </div>
  )
}
