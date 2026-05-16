'use client'

import { useEffect, useState } from 'react'

export type OrbState = 'idle' | 'thinking' | 'speaking' | 'listening' | 'error'

let globalState: OrbState = 'idle'
const listeners = new Set<(s: OrbState) => void>()

export function setOrbState(state: OrbState) {
  globalState = state
  listeners.forEach(fn => fn(state))
}

export function StatusOrb({ size = 32 }: { size?: number }) {
  const [state, setState] = useState<OrbState>(globalState)

  useEffect(() => {
    listeners.add(setState)
    return () => { listeners.delete(setState) }
  }, [])

  const configs: Record<OrbState, { color: string; glow: string; label: string; pulse: string }> = {
    idle:      { color: '#00e5ff', glow: 'rgba(0,229,255,0.4)',   label: 'ONLINE',     pulse: '3s' },
    thinking:  { color: '#a78bfa', glow: 'rgba(167,139,250,0.5)', label: 'THINKING',   pulse: '0.8s' },
    speaking:  { color: '#34d399', glow: 'rgba(52,211,153,0.5)',  label: 'SPEAKING',   pulse: '0.5s' },
    listening: { color: '#f87171', glow: 'rgba(248,113,113,0.5)', label: 'LISTENING',  pulse: '0.4s' },
    error:     { color: '#ef4444', glow: 'rgba(239,68,68,0.5)',   label: 'ERROR',      pulse: '1s' },
  }

  const c = configs[state]

  return (
    <div className="flex items-center gap-2 select-none" title={`NEXUS ${c.label}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer ring pulse */}
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: c.glow, animationDuration: c.pulse, opacity: 0.4 }}
        />
        {/* Core */}
        <div
          className="absolute inset-[4px] rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 35%, white, ${c.color})`,
            boxShadow: `0 0 ${size/2}px ${c.glow}`,
          }}
        />
      </div>
      <span className="hud-label text-xs" style={{ color: c.color, fontSize: 9 }}>{c.label}</span>
    </div>
  )
}
