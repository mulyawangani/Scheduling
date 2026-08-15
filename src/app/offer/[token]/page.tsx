import { createAdminClient } from '@/lib/supabase/admin'
import { RespondButtons } from './respond-buttons'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function OfferPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: offer } = await supabase
    .from('session_plans')
    .select(
      'id, recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end, note, status, students(name), profiles!session_plans_teacher_id_fkey(name), subjects(name)'
    )
    .eq('token', token)
    .single()

  if (!offer) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-xl font-semibold">Offer not found</h1>
        <p className="text-gray-600">This link may be invalid or expired.</p>
      </main>
    )
  }

  const studentName = Array.isArray(offer.students) ? offer.students[0]?.name : offer.students?.name
  const teacherName = Array.isArray(offer.profiles) ? offer.profiles[0]?.name : offer.profiles?.name
  const subjectName = Array.isArray(offer.subjects) ? offer.subjects[0]?.name : offer.subjects?.name

  const when =
    offer.recurrence_type === 'one_off' && offer.start_time && offer.end_time
      ? `${dateFormatter.format(new Date(offer.start_time))} until ${dateFormatter.format(new Date(offer.end_time))}`
      : `Every ${DAYS[offer.day_of_week ?? 0]}, ${offer.time_of_day_start?.slice(0, 5)}–${offer.time_of_day_end?.slice(0, 5)}`

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">
          {studentName ? `A session for ${studentName}` : 'You have a session offer'}
        </h1>
        <p className="mt-1 text-gray-600">
          {teacherName} — {subjectName}. Let us know if this works for you.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <p className="font-medium">{when}</p>
        {offer.note && <p className="mt-3 text-sm text-gray-700">{offer.note}</p>}
      </div>

      {offer.status === 'pending' && <RespondButtons token={token} />}

      {offer.status === 'accepted' && (
        <p className="rounded-lg bg-green-50 p-3 text-center font-medium text-green-700">
          You accepted this session. See you then!
        </p>
      )}

      {offer.status === 'declined' && (
        <p className="rounded-lg bg-gray-100 p-3 text-center font-medium text-gray-700">
          You declined this session.
        </p>
      )}

      {offer.status === 'cancelled' && (
        <p className="rounded-lg bg-gray-100 p-3 text-center font-medium text-gray-700">
          This session was cancelled.
        </p>
      )}
    </main>
  )
}
