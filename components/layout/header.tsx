'use client'

import { useSession } from 'next-auth/react'
import { Bell, Search, Cpu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchContext } from '@/components/search/search-provider'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const router = useRouter()
  const { openPalette } = useSearchContext()

  useEffect(() => {
    fetch('/api/notifications?unreadOnly=true')
      .then(r => r.json())
      .then(d => setUnreadCount(d.unreadCount || 0))
      .catch(() => {})
  }, [])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      openPalette(searchQuery)
      setSearchQuery('')
    }
  }

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3.5 border-b border-cyan-400/10"
      style={{
        background: 'rgba(5, 5, 16, 0.9)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Page title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-cyan-400/60 flex-shrink-0" />
          <h1 className="text-white font-semibold text-base truncate">{title}</h1>
        </div>
        {subtitle && (
          <p className="text-white/40 text-xs mt-0.5 nexus-mono">{subtitle}</p>
        )}
      </div>

      {/* Search */}
      <div
        className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-400/10 bg-white/3 w-56 group focus-within:border-cyan-400/30 transition-all cursor-text"
        onClick={() => openPalette()}
      >
        <Search size={13} className="text-white/30 group-focus-within:text-cyan-400/60 transition-colors flex-shrink-0" />
        <input
          type="text"
          placeholder="Search NEXUS..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent text-sm text-white/70 placeholder-white/25 outline-none flex-1 w-full cursor-pointer"
          onKeyDown={handleSearchKeyDown}
          onFocus={(e) => {
            // Immediately open palette on focus instead of typing in the dummy input
            e.target.blur()
            openPalette()
          }}
        />
        <kbd className="text-white/20 text-[10px] nexus-mono border border-white/10 rounded px-1 py-0.5 flex-shrink-0 group-focus-within:opacity-0">
          ⌘K
        </kbd>
      </div>

      {/* Clock */}
      <div className="hidden lg:flex flex-col items-end">
        <span className="text-white/70 text-sm font-mono">{timeStr}</span>
        <span className="text-white/30 text-[10px] nexus-mono">{dateStr}</span>
      </div>

      {/* Notifications */}
      <button
        onClick={() => router.push('/notifications')}
        className="relative p-2 rounded-lg text-white/40 hover:text-cyan-400 hover:bg-cyan-400/5 transition-all border border-transparent hover:border-cyan-400/15"
        title="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-cyan-400 rounded-full flex items-center justify-center text-[9px] text-black font-bold px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* User avatar */}
      <div className="w-8 h-8 rounded-full border border-cyan-400/20 overflow-hidden bg-gradient-to-br from-cyan-900/40 to-violet-900/40 flex items-center justify-center flex-shrink-0">
        {session?.user?.image ? (
          <img src={session.user.image} alt="User" className="w-full h-full object-cover" />
        ) : (
          <span className="text-cyan-400 text-xs font-bold">
            {(session?.user?.name || session?.user?.email || 'U').charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </header>
  )
}
