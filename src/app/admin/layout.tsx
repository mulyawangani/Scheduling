import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/auth/get-user-profile'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await getUserProfile()

  if (!result) {
    redirect('/login')
  }

  if (result.profile.role !== 'owner') {
    redirect('/')
  }

  return <>{children}</>
}
