import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { AdminNav } from './admin-nav'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await getUserProfile()

  if (!result) {
    redirect('/login')
  }

  if (result.profile.role !== 'owner' && result.profile.role !== 'admin') {
    redirect('/')
  }

  return (
    <>
      <AdminNav role={result.profile.role} />
      {children}
    </>
  )
}
