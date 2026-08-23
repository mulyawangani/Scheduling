import type { ChangeEvent } from 'react'

// Every session in this app is booked on the hour (see HOURS in generate-schedule.ts,
// 8:00 through 17:00) — a free-typed minute field just invites "08:15" that can never
// actually match a slot, so this replaces <input type="time"> with a fixed on-the-hour list.
const HOUR_OPTIONS = Array.from({ length: 10 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`)

export function HourSelect({
  name,
  required,
  defaultValue,
  value,
  onChange,
  className,
}: {
  name?: string
  required?: boolean
  defaultValue?: string
  /** Controlled mode (e.g. a standalone picker outside a <form>) — pass alongside onChange instead of defaultValue. */
  value?: string
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void
  className?: string
}) {
  const controlledProps = value !== undefined ? { value, onChange } : { defaultValue: defaultValue ?? '' }
  return (
    <select name={name} required={required} className={className} {...controlledProps}>
      <option value="" disabled>
        Time
      </option>
      {HOUR_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  )
}
