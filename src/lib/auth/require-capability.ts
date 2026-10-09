import { redirect } from 'next/navigation'
import { getUserProfile } from './get-user-profile'
import { accessOf, isStaffRole, type Access, type Capability } from './permissions'

type Need = 'view' | 'change'

function allowed(access: Access, need: Need) {
  return need === 'change' ? access === 'yes' : access !== 'no'
}

/**
 * Page guard for the admin side. Signed out goes to the sign-in page, a role
 * outside the admin side goes home, and a staff role without the capability
 * goes back to the admin dashboard (which every staff role may open).
 * `need: 'change'` is for pages that only make sense if the role can change things.
 */
export async function requireCapability(cap: Capability, need: Need = 'view') {
  const result = await getUserProfile()
  if (!result) redirect('/login')
  const role = result.profile.role
  if (!isStaffRole(role)) redirect('/')
  const access = accessOf(role, cap)
  if (!allowed(access, need)) redirect('/admin')
  return { ...result, role, access }
}

/**
 * Server-action guard. Server actions are web endpoints, so the page guard is
 * not enough: every action that changes data calls this first. Returns the
 * signed-in user, or an error object the action can return as-is.
 */
export async function authorize(cap: Capability, need: Need = 'change') {
  return authorizeAny([cap], need)
}

/** Like `authorize`, but passes when the role has at least one of the capabilities. */
export async function authorizeAny(caps: readonly Capability[], need: Need = 'change') {
  const result = await getUserProfile()
  if (!result) return { ok: false as const, error: 'You must be signed in.' }
  const role = result.profile.role
  if (!isStaffRole(role) || !caps.some((cap) => allowed(accessOf(role, cap), need))) {
    return { ok: false as const, error: 'You do not have permission to do this.' }
  }
  return { ok: true as const, ...result, role }
}
