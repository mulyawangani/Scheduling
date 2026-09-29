'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type ChildInfo = {
  id: string
  name: string
  nickname: string | null
  schoolName: string | null
}

type ParentCtx = {
  kids: ChildInfo[]
  selectedId: string | null
  selectedChild: ChildInfo | null
  setSelectedId: (id: string) => void
}

const ParentContext = createContext<ParentCtx>({
  kids: [],
  selectedId: null,
  selectedChild: null,
  setSelectedId: () => {},
})

export function ParentProvider({
  children,
  kids,
}: {
  children: ReactNode
  kids: ChildInfo[]
}) {
  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return kids[0]?.id ?? null
    try {
      const saved = localStorage.getItem('parent_selected_child')
      if (saved && kids.some(k => k.id === saved)) return saved
    } catch {}
    return kids[0]?.id ?? null
  })

  function setSelectedId(id: string) {
    setSelectedIdState(id)
    try { localStorage.setItem('parent_selected_child', id) } catch {}
  }

  const selectedChild = kids.find(k => k.id === selectedId) ?? kids[0] ?? null

  return (
    <ParentContext.Provider value={{ kids, selectedId, selectedChild, setSelectedId }}>
      {children}
    </ParentContext.Provider>
  )
}

export function useParentContext() {
  return useContext(ParentContext)
}
