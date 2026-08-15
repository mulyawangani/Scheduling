import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StudentEditor } from './student-editor'
import { SessionsList, type SessionRow } from './sessions-list'

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: student }, { data: subjects }, { data: studentSubjects }, { data: availability }, { data: sessions }] =
    await Promise.all([
      supabase.from('students').select('id, name').eq('id', id).single(),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('student_subjects').select('subject_id').eq('student_id', id),
      supabase.from('student_availability').select('*').eq('student_id', id).order('day_of_week'),
      supabase
        .from('session_plans')
        .select(
          'id, recurrence_type, start_time, end_time, day_of_week, time_of_day_start, time_of_day_end, status, subjects(name), profiles!session_plans_teacher_id_fkey(name)'
        )
        .eq('student_id', id)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false }),
    ])

  if (!student) {
    notFound()
  }

  const sessionRows: SessionRow[] = (sessions ?? []).map((s) => ({
    id: s.id,
    recurrenceType: s.recurrence_type,
    startTime: s.start_time,
    endTime: s.end_time,
    dayOfWeek: s.day_of_week,
    timeOfDayStart: s.time_of_day_start,
    timeOfDayEnd: s.time_of_day_end,
    status: s.status,
    teacherName: (Array.isArray(s.profiles) ? s.profiles[0]?.name : s.profiles?.name) ?? 'Unknown teacher',
    subjectName: (Array.isArray(s.subjects) ? s.subjects[0]?.name : s.subjects?.name) ?? 'Unknown subject',
  }))

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-xl font-semibold">{student.name}</h1>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-gray-700">Scheduled sessions</h2>
        <SessionsList studentId={id} sessions={sessionRows} />
      </section>

      <StudentEditor
        studentId={id}
        subjects={subjects ?? []}
        selectedSubjectIds={(studentSubjects ?? []).map((s) => s.subject_id)}
        availability={availability ?? []}
      />
    </main>
  )
}
