import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/auth/get-user-profile'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await getUserProfile()

  if (!result) {
    redirect('/login')
  }

  // 'admin' is a narrower operational role (scheduling, WhatsApp push, billing,
  // reports only) — pages that must stay owner-exclusive call requireOwner()
  // themselves, since this layout can't distinguish routes within /admin.
  if (result.profile.role !== 'owner' && result.profile.role !== 'admin') {
    redirect('/')
  }

  return <>{children}</>
}
