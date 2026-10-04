import { requireNanny } from '@/lib/auth/require-nanny'
import { NannyNav } from './nanny-nav'

export default async function NannyLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireNanny()

  return (
    <div className="min-h-screen bg-gray-50">
      <NannyNav name={profile.name} />
      <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
    </div>
  )
}
