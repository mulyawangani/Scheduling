import { redirect } from 'next/navigation'

export default async function LegacyStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/parent/therapy/${id}`)
}
