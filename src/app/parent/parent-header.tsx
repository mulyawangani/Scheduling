'use client'

import { useState } from 'react'
import { useParentContext } from './parent-context'

export function ParentHeader() {
  const { kids, selectedChild, setSelectedId } = useParentContext()
  const [open, setOpen] = useState(false)

  const displayName = selectedChild?.nickname ?? selectedChild?.name ?? null
  const schoolName = selectedChild?.schoolName ?? null

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
      style={{
        background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)',
        paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
      }}
    >
      {/* Logo */}
      <div className="text-white font-black tracking-[0.2em] text-base">PLAYTICS</div>

      {/* Child + school selector */}
      <div className="relative">
        <button
          onClick={() => kids.length > 1 && setOpen(o => !o)}
          className="flex items-center gap-1.5 text-right"
          style={{ cursor: kids.length > 1 ? 'pointer' : 'default' }}
        >
          <div>
            {displayName ? (
              <>
                <p className="text-white text-xs font-semibold leading-tight">{displayName}</p>
                {schoolName && (
                  <p className="text-orange-100 text-[10px] leading-tight">📍 {schoolName}</p>
                )}
              </>
            ) : (
              <p className="text-orange-100 text-xs">No child selected</p>
            )}
          </div>
          {kids.length > 1 && (
            <span className="text-white text-xs opacity-70">{open ? '▲' : '▼'}</span>
          )}
        </button>

        {open && kids.length > 1 && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <div
              className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl overflow-hidden z-50 min-w-[160px]"
              style={{ border: '1px solid rgba(0,0,0,0.08)' }}
            >
              {kids.map(k => (
                <button
                  key={k.id}
                  onClick={() => { setSelectedId(k.id); setOpen(false) }}
                  className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors"
                  style={{ borderBottom: '1px solid #F3F4F6' }}
                >
                  <p className="text-sm font-semibold text-gray-800">{k.nickname ?? k.name}</p>
                  {k.schoolName && (
                    <p className="text-xs text-gray-400">📍 {k.schoolName}</p>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
