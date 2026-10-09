import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/auth/get-user-profile'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const result = await getUserProfile()

  if (!result) {
    redirect('/login')
  }

  switch (result.profile.role) {
    case 'owner':
    case 'admin':
    case 'principal':
      redirect('/admin')
    case 'teacher':
      redirect('/teacher')
    case 'parent':
      redirect('/parent')
    case 'nanny':
      redirect('/nanny')
  }
}
