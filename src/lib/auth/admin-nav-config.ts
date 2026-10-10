import { can, canAny, type Capability, type StaffRole } from './permissions'

export type NavGroupKey = 'people' | 'school' | 'therapy' | 'money' | 'settings'

export const NAV_GROUP_LABEL: Record<NavGroupKey, string> = {
  people: 'People',
  school: 'School',
  therapy: 'Therapy',
  money: 'Money',
  settings: 'Settings',
}

export type NavItem = {
  label: string
  href: string
  group: NavGroupKey
  /** Shown when the role may use at least one of these. */
  any: readonly Capability[]
}

// The menu is derived from the permission table: nobody sees a link to a page
// they cannot open, and the Owner sees every page the Owner is allowed to use.
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Teachers', href: '/admin/teachers', group: 'people', any: ['people.staff.view'] },
  { label: 'Parents', href: '/admin/parents', group: 'people', any: ['students.view'] },
  { label: 'Students', href: '/admin/children', group: 'people', any: ['students.view'] },

  { label: 'Classrooms', href: '/admin/classrooms', group: 'school', any: ['ops.classrooms'] },
  { label: 'Enrollment', href: '/admin/enrollment', group: 'school', any: ['students.enrollment'] },
  { label: 'Attendance', href: '/admin/attendance', group: 'school', any: ['ops.attendance.view'] },
  { label: 'Announcements', href: '/admin/announcements', group: 'school', any: ['ops.announcements'] },
  { label: 'Extracurricular', href: '/admin/extracurricular', group: 'school', any: ['ops.extracurricular'] },

  { label: 'Overview', href: '/admin/therapy', group: 'therapy', any: ['sched.generate'] },
  { label: 'Calendar', href: '/admin/schedule', group: 'therapy', any: ['sched.calendar'] },
  {
    label: 'Scheduling',
    href: '/admin/suggestions',
    group: 'therapy',
    any: ['sched.generate', 'sched.manual', 'sched.reschedule', 'sched.versions', 'sched.schedules', 'sched.rules', 'sched.rates', 'sched.needs', 'sched.reports'],
  },
  { label: 'Therapy notes', href: '/admin/therapy-notes', group: 'therapy', any: ['notes.review'] },
  { label: 'Protocols', href: '/admin/protocols', group: 'therapy', any: ['sched.protocolsLibrary'] },

  { label: 'Billing', href: '/admin/billing', group: 'money', any: ['ops.billing'] },

  { label: 'Schools', href: '/admin/schools', group: 'settings', any: ['settings.school'] },
  { label: 'Holidays', href: '/admin/calendar', group: 'settings', any: ['settings.holidays'] },
  { label: 'Audit log', href: '/admin/audit-log', group: 'settings', any: ['audit.view'] },
]

/** The Scheduling tabs, with what each one needs. The Simulations tab is the Scheduling landing page for the Owner. */
export const SCHEDULING_TABS: readonly { href: string; label: string; need: Capability }[] = [
  { href: '/admin/suggestions', label: 'Simulations', need: 'sched.generate' },
  { href: '/admin/suggestions/quota', label: 'Quota', need: 'people.teacher.quota' },
  { href: '/admin/suggestions/capacity', label: 'Capacity', need: 'sched.rules' },
  { href: '/admin/suggestions/rules', label: 'Rules', need: 'sched.rules' },
  { href: '/admin/suggestions/recommendation', label: 'Recommendation', need: 'sched.needs' },
  { href: '/admin/suggestions/reschedule', label: 'Reschedule', need: 'sched.reschedule' },
  { href: '/admin/suggestions/schedules', label: 'Schedules', need: 'sched.schedules' },
  { href: '/admin/suggestions/reports', label: 'Reports', need: 'sched.reports' },
  { href: '/admin/suggestions/billing', label: 'Billing', need: 'sched.rates' },
]

/** Where the Scheduling menu entry should land for this role (the first tab the role may open). */
export function schedulingHome(role: StaffRole | string | null | undefined): string {
  // The Owner lands on Simulations. A role that cannot generate schedules lands on
  // Schedules (sending confirmed sessions to parents), then Reschedule, Reports, Billing.
  const order: Capability[] = ['sched.generate', 'sched.schedules', 'sched.reschedule', 'sched.reports', 'sched.rates']
  for (const need of order) {
    if (!can(role, need)) continue
    const tab = SCHEDULING_TABS.find((t) => t.need === need)
    if (tab) return tab.href
  }
  return '/admin'
}

export type NavGroup = { key: NavGroupKey; label: string; items: (NavItem & { resolvedHref: string })[] }

/** The menu for one role: the Dashboard link is added by the component; groups with no visible item are dropped. */
export function navFor(role: StaffRole | string | null | undefined): NavGroup[] {
  const groups: NavGroup[] = []
  for (const key of Object.keys(NAV_GROUP_LABEL) as NavGroupKey[]) {
    const items = NAV_ITEMS.filter((i) => i.group === key && canAny(role, i.any)).map((i) => ({
      ...i,
      resolvedHref: i.href === '/admin/suggestions' ? schedulingHome(role) : i.href,
    }))
    if (items.length) groups.push({ key, label: NAV_GROUP_LABEL[key], items })
  }
  return groups
}
