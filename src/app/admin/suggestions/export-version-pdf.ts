import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ParsedScheduleVersion } from './versions-panel'
import type { ExistingSessionForGrid, WeekHoliday } from '@/lib/matching/generate-schedule'
import { formatWeekLabel, dateForDayOfWeek } from '@/lib/week'

const WEEKDAYS = [1, 2, 3, 4, 5]
const DAY_NAMES: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' }
const HOURS = Array.from({ length: 9 }, (_, i) => 8 + i)
const dateLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })

function cellKey(day: number, hour: number) {
  return `${day}-${hour}`
}

/** Generates and downloads a one-page-plus PDF of a saved schedule version — the same weekly grid, scheduled sessions, proposed sessions, and not-scheduled list shown on screen, for sharing with staff who don't have app access. */
export function exportVersionPdf(
  version: ParsedScheduleVersion,
  weekStartDate: string,
  existing: ExistingSessionForGrid[],
  holidays: WeekHoliday[]
) {
  const doc = new jsPDF()
  const holidayByDate = new Map(holidays.map((h) => [h.date, h]))

  doc.setFontSize(16)
  doc.text(`Schedule report — ${version.label}`, 14, 18)

  doc.setFontSize(11)
  doc.setTextColor(90)
  doc.text(`Week of ${formatWeekLabel(weekStartDate)}`, 14, 26)
  doc.text(`Generated ${new Date(version.created_at).toLocaleString()}`, 14, 32)

  doc.setFontSize(12)
  doc.setTextColor(20)
  doc.text(
    `Scheduled: ${existing.length}    Proposed: ${version.proposals.length}    Not scheduled: ${version.unscheduled.length}`,
    14,
    42
  )

  // Weekly grid, matching the on-screen Simulations grid: same S#/P# numbering
  // (position within the existing/proposals arrays), one row per hour.
  const existingByCell = new Map<string, ExistingSessionForGrid[]>()
  existing.forEach((e) => {
    const key = cellKey(e.dayOfWeek, Number(e.startTime.slice(0, 2)))
    const arr = existingByCell.get(key) ?? []
    arr.push(e)
    existingByCell.set(key, arr)
  })
  const proposedByCell = new Map<string, number[]>()
  version.proposals.forEach((p, i) => {
    const key = cellKey(p.dayOfWeek, Number(p.startTime.slice(0, 2)))
    const arr = proposedByCell.get(key) ?? []
    arr.push(i)
    proposedByCell.set(key, arr)
  })

  const gridHead = [
    '',
    ...WEEKDAYS.map((day) => {
      const date = dateForDayOfWeek(weekStartDate, day)
      const holiday = holidayByDate.get(date)
      const lines = [DAY_NAMES[day], dateLabelFormatter.format(new Date(`${date}T00:00:00Z`))]
      if (holiday) lines.push(`(${holiday.name})`)
      return lines.join('\n')
    }),
  ]
  const gridBody = HOURS.map((hour) => [
    `${hour}:00`,
    ...WEEKDAYS.map((day) => {
      const key = cellKey(day, hour)
      const lines: string[] = []
      for (const e of existingByCell.get(key) ?? []) {
        lines.push(`S${existing.indexOf(e) + 1} ${e.teacherName}·${e.studentName}`)
      }
      for (const idx of proposedByCell.get(key) ?? []) {
        const p = version.proposals[idx]
        lines.push(`P${idx + 1} ${p.teacherName}·${p.studentName}`)
      }
      return lines.join('\n')
    }),
  ])

  autoTable(doc, {
    startY: 48,
    head: [gridHead],
    body: gridBody,
    headStyles: { fillColor: [55, 65, 81], fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 1.5, valign: 'top' },
    columnStyles: { 0: { cellWidth: 14 } },
    margin: { left: 14, right: 14 },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursorY = (doc as any).lastAutoTable.finalY + 10

  if (existing.length > 0) {
    doc.setFontSize(12)
    doc.setTextColor(20)
    doc.text('Scheduled sessions', 14, cursorY)
    autoTable(doc, {
      startY: cursorY + 4,
      head: [['#', 'Student', 'Protocol', 'Teacher', 'Day', 'Time']],
      body: existing.map((e, i) => [
        `S${i + 1}`,
        e.studentName,
        e.protocolName,
        e.teacherName,
        `${DAY_NAMES[e.dayOfWeek]} ${dateLabelFormatter.format(new Date(`${e.date}T00:00:00Z`))}`,
        `${e.startTime.slice(0, 5)}–${e.endTime.slice(0, 5)}`,
      ]),
      headStyles: { fillColor: [75, 85, 99] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (doc as any).lastAutoTable.finalY + 10
  }

  if (version.proposals.length > 0) {
    doc.setFontSize(12)
    doc.setTextColor(20)
    doc.text('Proposed sessions', 14, cursorY)
    autoTable(doc, {
      startY: cursorY + 4,
      head: [['#', 'Student', 'Protocol', 'Teacher', 'Day', 'Time', 'Match']],
      body: version.proposals.map((p, i) => [
        `P${i + 1}`,
        p.studentName,
        p.protocolName,
        p.teacherName,
        `${DAY_NAMES[p.dayOfWeek]} ${dateLabelFormatter.format(new Date(`${p.date}T00:00:00Z`))}`,
        `${p.startTime.slice(0, 5)}–${p.endTime.slice(0, 5)}`,
        `${p.matchScorePercent}%`,
      ]),
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (doc as any).lastAutoTable.finalY + 10
  }

  if (version.unscheduled.length > 0) {
    doc.setFontSize(12)
    doc.setTextColor(20)
    doc.text('Not scheduled', 14, cursorY)
    autoTable(doc, {
      startY: cursorY + 4,
      head: [['Student', 'Protocol']],
      body: version.unscheduled.map((u) => [u.studentName, u.protocolName]),
      headStyles: { fillColor: [217, 119, 6] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    })
  }

  doc.save(`${version.label}-${weekStartDate}.pdf`)
}
