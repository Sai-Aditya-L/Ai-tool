'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchContext } from '@/components/search/search-provider'

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { openPalette } = useSearchContext()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      // Skip if typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case 'k': e.preventDefault(); openPalette(); break
        case 't': e.preventDefault(); router.push('/tasks'); break
        case 'n': e.preventDefault(); router.push('/notes'); break
        case 'j': e.preventDefault(); router.push('/chat'); break // j = "journal/AI"
        case 'r': e.preventDefault(); router.push('/reminders'); break
        case 'd': e.preventDefault(); router.push('/dashboard'); break
        case '/': e.preventDefault(); openPalette(); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, openPalette])

  return <>{children}</>
}
