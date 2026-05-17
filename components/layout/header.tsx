'use client'

import { useSession } from 'next-auth/react'
import { Bell, Search, Cpu, Loader2, Timer } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchContext } from '@/components/search/search-provider'
import { ModeSwitcher } from '@/components/ui/mode-switcher'
import { useNexusLive } from '@/components/providers/nexus-live-provider'
import { useActivityPanel } from '@/components/providers/activity-panel-provider'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()
  const { openPalette } = useSearchContext()
  const { unreadCount, activeRun, activeFocus, connected } = useNexusLive()
  const { setOpen: openActivityPanel } = useActivityPanel()

  const [, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(iv)
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
    <header className="hud-header sticky top-0 z-20 flex items-center gap-4 px-6 py-3.5"
    >
      {/* Page title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-cyan-400/60 flex-shrink-0" />
          <h1 className="font-semibold text-base truncate hud-text-cyan" style={{letterSpacing:'0.05em'}}>{title}</h1>
        </div>
        {subtitle && (
          <p className="text-white/40 text-xs mt-0.5 nexus-mono">{subtitle}</p>
        )}
      </div>

      {/* Search */}
      <div
        className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-400/15 bg-white/3 w-56 group focus-within:border-cyan-400/30 transition-all cursor-text"
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

      {/* Mode Switcher */}
      <ModeSwitcher />

      {/* Focus session indicator */}
      {activeFocus && (
        <button
          onClick={() => router.push('/focus')}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-400/20 bg-amber-400/5 text-amber-400 hover:bg-amber-400/10 transition-all"
          title={`Focus: ${activeFocus.taskTitle || 'Deep work'}`}
        >
          <Timer size={11} className="flex-shrink-0" />
          <span className="text-[10px] nexus-mono">FOCUS</span>
        </button>
      )}

      {/* Agent active indicator */}
      {activeRun && (activeRun.status === 'running' || activeRun.status === 'waiting') && (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-400/20 bg-violet-400/5 text-violet-400">
          <Loader2 size={11} className="animate-spin flex-shrink-0" />
          <span className="text-[10px] nexus-mono truncate max-w-[120px]">
            {activeRun.task.length > 22 ? activeRun.task.slice(0, 22) + '…' : activeRun.task}
          </span>
        </div>
      )}

      {/* SSE connection dot */}
      <div title={connected ? 'NEXUS live' : 'Connecting…'} className="flex-shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
      </div>

      {/* Clock */}
      <div className="hidden lg:flex flex-col items-end pl-4 border-l border-cyan-400/10">
        <span className="hud-value text-sm">{timeStr}</span>
        <span className="hud-label text-[10px] opacity-50">{dateStr}</span>
      </div>

      {/* Notifications / Activity Panel trigger */}
      <button
        onClick={() => openActivityPanel(true)}
        className="relative p-2 rounded-lg text-white/40 hover:text-cyan-400 hover:bg-cyan-400/5 transition-all border border-transparent hover:border-cyan-400/15"
        title="NEXUS Live Activity"
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
