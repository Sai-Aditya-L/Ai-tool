'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, MessageSquare, CheckSquare, Bell, Calendar,
  FileText, Brain, FolderOpen, BarChart2, Zap, Activity,
  Puzzle, Settings, LogOut, Mic, ChevronLeft, ChevronRight,
  StickyNote, Mail
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  {
    group: 'Core',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', color: 'text-cyan-400' },
      { href: '/chat', icon: MessageSquare, label: 'AI Chat', color: 'text-violet-400' },
      { href: '/voice', icon: Mic, label: 'Voice Center', color: 'text-cyan-400' },
    ],
  },
  {
    group: 'Organize',
    items: [
      { href: '/tasks', icon: CheckSquare, label: 'Tasks', color: 'text-green-400' },
      { href: '/reminders', icon: Bell, label: 'Reminders', color: 'text-yellow-400' },
      { href: '/calendar', icon: Calendar, label: 'Calendar', color: 'text-blue-400' },
      { href: '/emails', icon: Mail, label: 'Emails', color: 'text-cyan-400' },
      { href: '/notes', icon: StickyNote, label: 'Notes', color: 'text-pink-400' },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      { href: '/memory', icon: Brain, label: 'Memory', color: 'text-violet-400' },
      { href: '/trackers', icon: BarChart2, label: 'Trackers', color: 'text-orange-400' },
      { href: '/automations', icon: Zap, label: 'Automations', color: 'text-yellow-400' },
      { href: '/files', icon: FolderOpen, label: 'Files', color: 'text-cyan-400' },
    ],
  },
  {
    group: 'System',
    items: [
      { href: '/notifications', icon: Bell, label: 'Notifications', color: 'text-yellow-400' },
      { href: '/activity', icon: Activity, label: 'Activity Log', color: 'text-green-400' },
      { href: '/integrations', icon: Puzzle, label: 'Integrations', color: 'text-blue-400' },
      { href: '/settings', icon: Settings, label: 'Settings', color: 'text-white/60' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'flex flex-col h-screen sticky top-0 transition-all duration-300 z-30',
        'border-r border-cyan-400/10',
        collapsed ? 'w-16' : 'w-64'
      )}
      style={{
        background: 'rgba(5, 5, 16, 0.95)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-400/10">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="relative w-8 h-8 flex-shrink-0">
              <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-spin-slow" />
              <div className="absolute inset-1 rounded-full border border-violet-500/30 animate-spin-reverse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.9) 0%, rgba(124,58,237,0.7) 100%)' }}
                />
              </div>
            </div>
            <div>
              <span className="font-bold text-sm nexus-text-gradient tracking-wider">NEXUS</span>
              <div className="text-white/30 text-[10px] nexus-mono leading-none">v1.0 ONLINE</div>
            </div>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="relative w-8 h-8 flex-shrink-0 mx-auto">
            <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-spin-slow" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.9) 0%, rgba(124,58,237,0.7) 100%)' }}
              />
            </div>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-white/30 hover:text-cyan-400 transition-colors p-1 rounded-lg hover:bg-cyan-400/5 flex-shrink-0"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 no-scrollbar">
        {navItems.map((group) => (
          <div key={group.group} className="mb-6">
            {!collapsed && (
              <p className="text-white/25 text-[10px] uppercase tracking-[0.15em] px-3 mb-2 nexus-mono">
                {group.group}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative',
                        isActive
                          ? 'bg-cyan-400/10 border border-cyan-400/20'
                          : 'hover:bg-white/5 border border-transparent hover:border-white/5',
                        collapsed && 'justify-center px-2'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        size={16}
                        className={cn(
                          'flex-shrink-0 transition-colors',
                          isActive ? item.color : 'text-white/40 group-hover:text-white/70'
                        )}
                      />
                      {!collapsed && (
                        <span className={cn(
                          'text-sm font-medium transition-colors',
                          isActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'
                        )}>
                          {item.label}
                        </span>
                      )}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-cyan-400 rounded-r" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-cyan-400/10">
        {session?.user && (
          <div className={cn('flex items-center gap-3', collapsed && 'flex-col gap-2')}>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm font-medium truncate">
                  {session.user.name || 'User'}
                </p>
                <p className="text-white/30 text-xs truncate nexus-mono">
                  {session.user.email}
                </p>
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-white/30 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/5 flex-shrink-0"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
