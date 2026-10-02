import { getUserProfile } from '@/lib/auth/get-user-profile'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ProfileForm } from './profile-form'
import { ProtocolsGrid } from './protocols-grid'

export const dynamic = 'force-dynamic'

export default async function TeacherProfilePage() {
  const result = await getUserProfile()
  if (!result) redirect('/login')

  const supabase = await createClient()
  const userId = result.user.id

  const [{ data: protocols }, { data: certRows }] = await Promise.all([
    supabase.from('protocols').select('id, title').eq('is_active', true).order('title'),
    supabase
      .from('teacher_protocols')
      .select('protocol_id, rating')
      .eq('teacher_id', userId)
      .is('sub_protocol_id', null),
  ])

  const certifiedCount = (certRows ?? []).length
  const totalProtocols = (protocols ?? []).length

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/teacher" className="text-sm text-gray-400 hover:text-gray-600">
            ← Dashboard
          </Link>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
        <div className="w-24" />
      </div>

      {/* Identity */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Identity
        </h2>
        <div className="rounded-xl border border-gray-200 p-5">
          <ProfileForm
            name={result.profile.name}
            phone={result.profile.phone ?? null}
            email={result.user.email ?? result.profile.email ?? ''}
          />
        </div>
      </section>

      {/* Certified Protocols */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Certified Protocols
          </h2>
          <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-600">
            {certifiedCount} / {totalProtocols}
          </span>
        </div>
        <p className="mb-3 text-sm text-gray-500">
          Check the protocols you are certified to deliver. Rate your proficiency 1–5 stars.
          Changes save automatically.
        </p>
        <ProtocolsGrid
          protocols={(protocols ?? []).map((p) => ({ id: p.id, title: p.title }))}
          certified={(certRows ?? []).map((r) => ({
            protocol_id: r.protocol_id,
            rating: r.rating,
          }))}
        />
      </section>

      {/* Availability shortcut */}
      <section className="rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800">Availability</p>
            <p className="mt-0.5 text-sm text-gray-500">Set the hours you are available each week.</p>
          </div>
          <Link
            href="/teacher/availability"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
            style={{ background: '#F59030' }}
          >
            Manage →
          </Link>
        </div>
      </section>

    </main>
  )
}
