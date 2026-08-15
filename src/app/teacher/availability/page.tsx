import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth/get-user-profile'
import { AvailabilityEditor } from './availability-editor'

export default async function TeacherAvailabilityPage() {
  const result = await getUserProfile()
  const supabase = await createClient()

  const { data: availability } = await supabase
    .from('teacher_availability')
    .select('*')
    .eq('teacher_id', result!.user.id)
    .order('day_of_week')

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-xl font-semibold">Your availability</h1>
      <AvailabilityEditor availability={availability ?? []} />
    </main>
  )
}
