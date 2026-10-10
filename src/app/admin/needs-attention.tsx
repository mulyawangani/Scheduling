import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { can, canChange, type StaffRole } from '@/lib/auth/permissions'
import { dateStringInBusinessTz } from '@/lib/timezone'

type Item = { key: string; count: number; text: string; href: string }

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}

/**
 * What is piling up for this role, so nothing waits unnoticed. Each line only
 * appears for a role that may act on it, and links to the screen where it is
 * handled.
 */
export async function NeedsAttention({ role }: { role: StaffRole }) {
  const supabase = await createClient()
  const today = dateStringInBusinessTz(new Date())
  const found: Record<string, Item> = {}

  const tasks: Promise<void>[] = []

  if (can(role, 'notes.review')) {
    tasks.push(
      (async () => {
        const { count } = await supabase
          .from('therapy_notes')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'submitted')
        const n = count ?? 0
        found.notes = {
          key: 'notes',
          count: n,
          text: `therapy ${plural(n, 'note is', 'notes are')} waiting for review`,
          href: '/admin/therapy-notes',
        }
      })()
    )
  }

  if (canChange(role, 'students.status')) {
    tasks.push(
      (async () => {
        const { count } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'trial')
        const n = count ?? 0
        found.trial = {
          key: 'trial',
          count: n,
          text: `Trial ${plural(n, 'child is', 'children are')} waiting for a status decision`,
          href: '/admin/children?status=trial',
        }
      })()
    )
  }

  // A child with therapies needed but therapy switched off is not scheduled until staff decide.
  if (canChange(role, 'students.therapy')) {
    tasks.push(
      (async () => {
        const { data } = await supabase.from('students').select('id, status, student_protocols(protocol_id)').eq('therapy_on', false)
        const n = (data ?? []).filter((s) => s.status !== 'inactive' && s.student_protocols.length > 0).length
        found.therapy = {
          key: 'therapy',
          count: n,
          text: `${plural(n, 'child has', 'children have')} therapies needed but therapy is off`,
          href: '/admin/children?therapy=waiting',
        }
      })()
    )
  }

  if (can(role, 'students.contacts.view')) {
    tasks.push(
      (async () => {
        const [{ data: students }, { data: contacts }] = await Promise.all([
          supabase.from('students').select('id').eq('status', 'student'),
          supabase.from('student_contacts').select('student_id'),
        ])
        const withContacts = new Set((contacts ?? []).map((c) => c.student_id))
        const n = (students ?? []).filter((s) => !withContacts.has(s.id)).length
        found.contacts = {
          key: 'contacts',
          count: n,
          text: `${plural(n, 'Student has', 'Students have')} no parent or emergency contact on file`,
          href: '/admin/children?status=student',
        }
      })()
    )
  }

  if (can(role, 'ops.attendance.view')) {
    tasks.push(
      (async () => {
        const { count } = await supabase
          .from('attendance_records')
          .select('id', { count: 'exact', head: true })
          .eq('date', today)
          .eq('status', 'absent')
          .is('absence_reason', null)
        const n = count ?? 0
        found.absent = {
          key: 'absent',
          count: n,
          text: `${plural(n, 'child is', 'children are')} marked absent today with no reason`,
          href: '/admin/attendance',
        }
      })()
    )
  }

  await Promise.all(tasks)

  const items = ['notes', 'trial', 'therapy', 'contacts', 'absent'].map((k) => found[k]).filter((i): i is Item => !!i)
  const open = items.filter((i) => i.count > 0)

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-800">Needs attention</h2>
      {open.length === 0 ? (
        <p className="text-sm text-green-700">Nothing needs attention right now.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100">
          {open.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-100 px-2 text-sm font-bold text-amber-800">
                  {i.count}
                </span>
                <span className="text-sm text-gray-700">{i.text}</span>
                <span aria-hidden="true" className="ml-auto text-gray-300">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
