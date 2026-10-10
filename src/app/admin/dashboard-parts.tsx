import Link from 'next/link'
import type { ReactNode } from 'react'

/** A number with its label, in a soft tile. */
export function Tile({ value, label, tone = '#111827' }: { value: ReactNode; label: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <div className="text-xl font-bold tabular-nums" style={{ color: tone }}>
        {value}
      </div>
      <div className="text-[11px] font-medium leading-tight text-gray-500">{label}</div>
    </div>
  )
}

/** One group of numbers on a dashboard. `wide` makes it span both columns of a two-column grid. */
export function Box({
  title,
  href,
  linkLabel,
  wide = false,
  children,
}: {
  title: string
  href?: string
  linkLabel?: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <section className={`flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${wide ? 'md:col-span-2' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {href && (
          <Link href={href} className="text-xs font-semibold text-orange-500 hover:underline">
            {linkLabel ?? 'Open'} →
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/** A small grey explanation under the numbers. */
export const Hint = ({ children }: { children: ReactNode }) => <p className="text-xs leading-relaxed text-gray-400">{children}</p>
