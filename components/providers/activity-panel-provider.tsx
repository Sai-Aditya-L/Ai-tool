'use client'
import { createContext, useContext, useState } from 'react'

const ActivityPanelContext = createContext<{
  open: boolean
  setOpen: (v: boolean) => void
}>({ open: false, setOpen: () => {} })

export function useActivityPanel() {
  return useContext(ActivityPanelContext)
}

export function ActivityPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <ActivityPanelContext.Provider value={{ open, setOpen }}>
      {children}
    </ActivityPanelContext.Provider>
  )
}
