import { redirect } from 'next/navigation'
import { getUserProfile } from './get-user-profile'

export async function requireAdminOrOwner() {
  const result = await getUserProfile()
  if (!result || (result.profile.role !== 'owner' && result.profile.role !== 'admin')) {
    redirect('/')
  }
  return result
}
