'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Mic, MessageSquare, Zap } from 'lucide-react'

interface AIOrbProps {
  userName?: string | null
}

export function AIOrb({ userName }: AIOrbProps) {
  const [greeting, setGreeting] = useState('')
  const [statusMsg, setStatusMsg] = useState('All systems operational')
  const [time, setTime] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')

    const updateTime = () => {
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)

    const messages = [
      'All systems operational',
      'Neural link active',
      'Memory synchronized',
      'Ready to assist',
      'Monitoring your workflows',
    ]
    let idx = 0
    const msgInterval = setInterval(() => {
      idx = (idx + 1) % messages.length
      setStatusMsg(messages[idx])
    }, 5000)

    return () => {
      clearInterval(interval)
      clearInterval(msgInterval)
    }
  }, [])

  const name = userName?.split(' ')[0] || 'Commander'

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col items-center relative overflow-hidden">
      {/* Scan line */}
      <div className="scan-line" />

      {/* Corner decorations */}
      <div className="absolute top-3 left-3 text-cyan-400/20 text-[10px] nexus-mono">SYS://NEXUS</div>
      <div className="absolute top-3 right-3 text-cyan-400/20 text-[10px] nexus-mono">{time}</div>

      {/* Orb */}
      <div className="relative w-32 h-32 mb-4">
        {/* Outer rings */}
        <div className="absolute inset-0 rounded-full border border-cyan-400/20 animate-spin-slow" />
        <div className="absolute inset-2 rounded-full border border-violet-500/15 animate-spin-reverse" />
        <div className="absolute inset-4 rounded-full border border-cyan-400/10 animate-spin-slow" style={{ animationDuration: '15s' }} />

        {/* Glow rings */}
        <div className="absolute inset-0 rounded-full"
          style={{ boxShadow: '0 0 30px rgba(0,212,255,0.12), 0 0 60px rgba(0,212,255,0.05)' }}
        />

        {/* Core orb */}
        <div className="absolute inset-6 rounded-full orb-pulse"
          style={{
            background: 'radial-gradient(circle at 35% 35%, rgba(0,212,255,0.95) 0%, rgba(0,180,230,0.8) 30%, rgba(124,58,237,0.7) 65%, rgba(90,30,200,0.5) 100%)',
            boxShadow: '0 0 30px rgba(0,212,255,0.5), 0 0 60px rgba(0,212,255,0.2), inset 0 0 20px rgba(255,255,255,0.15)',
          }}
        />

        {/* Inner sparkle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-white/60 blur-sm animate-pulse" />
        </div>

        {/* Orbit dot */}
        <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: '6s' }}>
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400"
            style={{ boxShadow: '0 0 6px rgba(0,212,255,0.8)' }}
          />
        </div>
        <div className="absolute inset-0 animate-spin-reverse" style={{ animationDuration: '10s' }}>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-400"
            style={{ boxShadow: '0 0 4px rgba(124,58,237,0.8)' }}
          />
        </div>
      </div>

      {/* Text */}
      <div className="text-center mb-4">
        <p className="text-white/40 text-xs tracking-widest uppercase nexus-mono mb-1">NEXUS ONLINE</p>
        <h2 className="text-white font-semibold text-lg">
          {greeting},{' '}
          <span className="nexus-text-primary">{name}</span>
        </h2>
        <p className="text-white/35 text-xs mt-1 nexus-mono">{statusMsg}</p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 w-full">
        <Link href="/chat" className="flex-1 nexus-btn-primary flex items-center justify-center gap-2 text-sm py-2">
          <MessageSquare size={14} />
          Chat
        </Link>
        <Link href="/voice" className="flex-1 nexus-btn-secondary flex items-center justify-center gap-2 text-sm py-2">
          <Mic size={14} />
          Voice
        </Link>
        <Link href="/automations" className="nexus-btn-secondary flex items-center justify-center px-3 py-2">
          <Zap size={14} />
        </Link>
      </div>
    </div>
  )
}
