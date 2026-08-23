'use client'

import { useState, type ReactNode } from 'react'

export function CollapsibleSection({
  title,
  actions,
  defaultOpen = true,
  children,
}: {
  title: ReactNode
  /** Rendered next to the title, outside the toggle — for buttons that should stay reachable while collapsed (e.g. "Book all"). */
  actions?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-left text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <span className={`inline-block text-[10px] text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          {title}
        </button>
        {actions}
      </div>
      {open && children}
    </div>
  )
}
