import { logout } from '@/lib/auth/logout'

export function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
        Log out
      </button>
    </form>
  )
}
