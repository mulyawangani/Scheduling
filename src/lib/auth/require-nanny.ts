import { redirect } from 'next/navigation'
import { getUserProfile } from './get-user-profile'

export async function requireNanny() {
  const result = await getUserProfile()
  if (!result || !['nanny', 'owner', 'admin'].includes(result.profile.role)) {
    redirect('/')
  }
  return result
}
