'use client'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const MODES = [
  { id: 'personal',  label: 'Personal',  icon: '🏠', color: 'text-cyan-400',   desc: 'Daily life & personal tasks' },
  { id: 'work',      label: 'Work',       icon: '💼', color: 'text-blue-400',   desc: 'Professional work mode' },
  { id: 'coding',    label: 'Coding',     icon: '⚙️', color: 'text-orange-400', desc: 'Development & coding workflows' },
  { id: 'security',  label: 'Security',   icon: '🛡️', color: 'text-red-400',    desc: 'Cybersecurity & audit work' },
  { id: 'research',  label: 'Research',   icon: '🔮', color: 'text-violet-400', desc: 'Deep research & analysis' },
  { id: 'focus',     label: 'Focus',      icon: '🎯', color: 'text-amber-400',  desc: 'Deep work, minimal distractions' },
  { id: 'travel',    label: 'Travel',     icon: '✈️', color: 'text-sky-400',    desc: 'Trip planning & logistics' },
  { id: 'meeting',   label: 'Meeting',    icon: '📡', color: 'text-pink-400',   desc: 'Meeting prep & notes' },
]

export function ModeSwitcher() {
  const [currentMode, setCurrentMode] = useState('personal')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/mode').then(r => r.json()).then(d => { if (d.mode) setCurrentMode(d.mode) }).catch(() => {})
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function switchMode(modeId: string) {
    setLoading(true)
    try {
      await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: modeId }),
      })
      setCurrentMode(modeId)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const active = MODES.find(m => m.id === currentMode) || MODES[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
          'border-white/10 bg-white/3 hover:bg-white/6 hover:border-white/20',
          active.color
        )}
      >
        <span>{active.icon}</span>
        <span className="hidden sm:block">{active.label}</span>
        <span className="text-white/30 text-[10px]">▼</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <p className="text-[10px] text-white/30 uppercase tracking-wider px-2 pb-1">Operating Mode</p>
          </div>
          <div className="p-1.5 space-y-0.5">
            {MODES.map(mode => (
              <button
                key={mode.id}
                onClick={() => switchMode(mode.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all',
                  currentMode === mode.id
                    ? 'bg-white/8 border border-white/10'
                    : 'hover:bg-white/5'
                )}
              >
                <span className="text-base">{mode.icon}</span>
                <div className="min-w-0">
                  <p className={cn('text-xs font-medium', currentMode === mode.id ? mode.color : 'text-white/70')}>
                    {mode.label}
                  </p>
                  <p className="text-[10px] text-white/30 truncate">{mode.desc}</p>
                </div>
                {currentMode === mode.id && <span className={cn('ml-auto text-[10px]', mode.color)}>●</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
