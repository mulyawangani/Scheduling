import { redirect } from 'next/navigation'

export default async function LegacyTherapyNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/parent/therapy/${id}/therapy-notes`)
}
