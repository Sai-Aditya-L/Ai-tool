'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CommandPalette } from './command-palette'

interface SearchContextValue {
  isOpen: boolean
  openPalette: (initialQuery?: string) => void
  closePalette: () => void
}

const SearchContext = createContext<SearchContextValue>({
  isOpen: false,
  openPalette: () => {},
  closePalette: () => {},
})

export function useSearchContext() {
  return useContext(SearchContext)
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [initialQuery, setInitialQuery] = useState('')

  const openPalette = useCallback((query?: string) => {
    setInitialQuery(query ?? '')
    setIsOpen(true)
  }, [])

  const closePalette = useCallback(() => {
    setIsOpen(false)
    setInitialQuery('')
  }, [])

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((open) => {
          if (open) {
            setInitialQuery('')
            return false
          }
          setInitialQuery('')
          return true
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <SearchContext.Provider value={{ isOpen, openPalette, closePalette }}>
      {children}
      <CommandPalette
        isOpen={isOpen}
        onClose={closePalette}
        initialQuery={initialQuery}
      />
    </SearchContext.Provider>
  )
}
