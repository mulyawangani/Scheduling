import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { isStaffRole } from '@/lib/auth/permissions'
import { AdminNav } from './admin-nav'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await getUserProfile()

  if (!result) {
    redirect('/login')
  }

  if (!isStaffRole(result.profile.role)) {
    redirect('/')
  }

  return (
    <>
      <AdminNav role={result.profile.role} name={result.profile.name} />
      {children}
    </>
  )
}
