'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Mic, MessageSquare, Zap } from 'lucide-react'

interface AIOrbProps {
  userName?: string | null
}

const SYSTEM_METRICS = [
  { label: 'CPU', value: '74%', color: '#00e5ff' },
  { label: 'MEM', value: '58%', color: '#ffa000' },
  { label: 'NET', value: '2.4G', color: '#00e5ff' },
  { label: 'API', value: 'OK', color: '#00ff88' },
]

export function AIOrb({ userName }: AIOrbProps) {
  const [greeting, setGreeting] = useState('')
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  const [statusMsg, setStatusMsg] = useState('ALL SYSTEMS NOMINAL')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('GOOD MORNING')
    else if (hour < 17) setGreeting('GOOD AFTERNOON')
    else setGreeting('GOOD EVENING')

    const updateTime = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
      setDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase())
      setTick(t => t + 1)
    }
    updateTime()
    const iv = setInterval(updateTime, 1000)

    const msgs = ['ALL SYSTEMS NOMINAL', 'NEURAL LINK ACTIVE', 'READY TO ASSIST', 'MEMORY SYNC OK', 'MONITORING WORKFLOWS']
    let i = 0
    const mv = setInterval(() => { i = (i + 1) % msgs.length; setStatusMsg(msgs[i]) }, 5000)

    return () => { clearInterval(iv); clearInterval(mv) }
  }, [])

  const name = userName?.split(' ')[0]?.toUpperCase() || 'COMMANDER'

  return (
    <div className="hud-panel hud-panel-inner rounded-2xl hud-scanlines relative overflow-hidden flex flex-col items-center py-8 px-4">
      {/* Animated scanline */}
      <div className="absolute left-0 right-0 h-px pointer-events-none z-20"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.6), transparent)', animation: 'hud-scan-v 6s linear infinite' }} />

      {/* Corner data labels */}
      <div className="absolute top-3 left-3 hud-label opacity-60">SYS://NEXUS-V2</div>
      <div className="absolute top-3 right-3 hud-value text-[11px]">{time}</div>
      <div className="absolute top-7 right-3 hud-label opacity-40">{date}</div>

      {/* Status dot top */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 hud-blink"
          style={{ boxShadow: '0 0 6px #00ff88' }} />
        <span className="hud-label text-green-400/70" style={{ fontSize: 9 }}>ONLINE</span>
      </div>

      {/* ── CENTRAL ORB ─────────────────────────────────── */}
      <div className="relative mt-6 mb-5" style={{ width: 200, height: 200 }}>

        {/* Outermost slow ring with tick marks */}
        <svg className="absolute inset-0 hud-spin-4" width={200} height={200} viewBox="0 0 200 200">
          <circle cx={100} cy={100} r={95} fill="none" stroke="rgba(0,229,255,0.1)" strokeWidth={1} strokeDasharray="4 12" />
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * 360
            const rad = (angle * Math.PI) / 180
            const x1 = 100 + Math.cos(rad) * 88
            const y1 = 100 + Math.sin(rad) * 88
            const x2 = 100 + Math.cos(rad) * 95
            const y2 = 100 + Math.sin(rad) * 95
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,229,255,0.25)" strokeWidth={i % 6 === 0 ? 2 : 0.8} />
          })}
        </svg>

        {/* Amber outer ring spinning ccw */}
        <svg className="absolute hud-spin-r3" style={{ inset: 8 }} width={184} height={184} viewBox="0 0 184 184">
          <circle cx={92} cy={92} r={86} fill="none" stroke="rgba(255,160,0,0.15)" strokeWidth={1.5} strokeDasharray="8 16" />
        </svg>

        {/* Data arc ring */}
        <svg className="absolute hud-spin-2" style={{ inset: 16 }} width={168} height={168} viewBox="0 0 168 168">
          <circle cx={84} cy={84} r={78} fill="none" stroke="rgba(0,229,255,0.18)" strokeWidth={1} />
          {/* Arc fill highlight */}
          <circle cx={84} cy={84} r={78} fill="none" stroke="rgba(0,229,255,0.6)" strokeWidth={2}
            strokeDasharray="60 440" strokeDashoffset="0" strokeLinecap="round" />
          <circle cx={84} cy={84} r={78} fill="none" stroke="rgba(255,160,0,0.5)" strokeWidth={2}
            strokeDasharray="30 410" strokeDashoffset="-180" strokeLinecap="round" />
        </svg>

        {/* CCW dashed ring */}
        <svg className="absolute hud-spin-r2" style={{ inset: 28 }} width={144} height={144} viewBox="0 0 144 144">
          <circle cx={72} cy={72} r={66} fill="none" stroke="rgba(0,229,255,0.12)" strokeWidth={1} strokeDasharray="3 9" />
        </svg>

        {/* Inner ring */}
        <svg className="absolute hud-spin-1" style={{ inset: 44 }} width={112} height={112} viewBox="0 0 112 112">
          <circle cx={56} cy={56} r={50} fill="none" stroke="rgba(0,229,255,0.2)" strokeWidth={1.5} />
          <circle cx={56} cy={56} r={50} fill="none" stroke="rgba(0,229,255,0.7)" strokeWidth={2}
            strokeDasharray="20 295" strokeDashoffset="-40" strokeLinecap="round" />
        </svg>

        {/* Core orb */}
        <div className="absolute" style={{ inset: 56 }}>
          <div className="w-full h-full rounded-full relative"
            style={{
              background: 'radial-gradient(circle at 35% 35%, rgba(0,229,255,0.95) 0%, rgba(0,180,230,0.85) 25%, rgba(0,100,200,0.7) 55%, rgba(10,10,60,0.9) 100%)',
              boxShadow: '0 0 20px rgba(0,229,255,0.7), 0 0 50px rgba(0,229,255,0.3), 0 0 100px rgba(0,229,255,0.1), inset 0 0 20px rgba(0,0,0,0.5)',
              animation: 'orbPulse 4s ease-in-out infinite',
            }}>
            {/* Inner arc lines */}
            <svg className="absolute inset-0 hud-spin-r1" width="100%" height="100%" viewBox="0 0 88 88">
              <circle cx={44} cy={44} r={36} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="5 20" />
            </svg>
            {/* White core spark */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full"
                style={{ background: 'radial-gradient(circle, #fff 0%, rgba(0,229,255,0.6) 60%, transparent 100%)', animation: 'orbPulse 2s ease-in-out infinite' }} />
            </div>
          </div>
        </div>

        {/* Orbiting dot 1 — cyan */}
        <div className="absolute" style={{ top: 0, left: 0, width: '100%', height: '100%', animation: 'hud-rotate-cw 4s linear infinite', transformOrigin: '100px 100px' }}>
          <div className="absolute w-2.5 h-2.5 rounded-full bg-cyan-400"
            style={{ top: 6, left: '50%', transform: 'translateX(-50%)', boxShadow: '0 0 8px #00e5ff, 0 0 16px #00e5ff' }} />
        </div>

        {/* Orbiting dot 2 — amber */}
        <div className="absolute" style={{ top: 0, left: 0, width: '100%', height: '100%', animation: 'hud-rotate-ccw 7s linear infinite', transformOrigin: '100px 100px' }}>
          <div className="absolute w-2 h-2 rounded-full"
            style={{ bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#ffa000', boxShadow: '0 0 6px #ffa000, 0 0 14px #ffa000' }} />
        </div>

        {/* Orbiting dot 3 — violet */}
        <div className="absolute" style={{ top: 0, left: 0, width: '100%', height: '100%', animation: 'hud-rotate-cw 11s linear infinite', transformOrigin: '100px 100px' }}>
          <div className="absolute w-1.5 h-1.5 rounded-full bg-violet-400"
            style={{ top: '50%', right: 8, transform: 'translateY(-50%)', boxShadow: '0 0 6px #7b61ff' }} />
        </div>

        {/* Ripple ring */}
        <div className="absolute rounded-full pointer-events-none"
          style={{ inset: 48, border: '1px solid rgba(0,229,255,0.3)', animation: 'hud-ripple 3s ease-out infinite' }} />
        <div className="absolute rounded-full pointer-events-none"
          style={{ inset: 48, border: '1px solid rgba(0,229,255,0.2)', animation: 'hud-ripple 3s ease-out 1.5s infinite' }} />

      </div>

      {/* ── System metrics row ──────────────────────────── */}
      <div className="flex gap-3 mb-4 w-full justify-center">
        {SYSTEM_METRICS.map(m => (
          <div key={m.label} className="flex flex-col items-center">
            <span className="hud-label" style={{ color: m.color, opacity: 0.6, fontSize: 8 }}>{m.label}</span>
            <span className="hud-value text-[11px]" style={{ color: m.color }}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* ── Greeting ────────────────────────────────────── */}
      <div className="text-center mb-1">
        <p className="hud-label mb-0.5" style={{ color: 'rgba(0,229,255,0.45)', fontSize: 9 }}>NEXUS INTERFACE ONLINE</p>
        <p className="hud-label" style={{ color: 'rgba(0,229,255,0.4)', fontSize: 9 }}>{greeting},</p>
        <h2 className="text-white font-bold text-lg tracking-widest mt-0.5 hud-text-glow" style={{ color: '#00e5ff' }}>
          {name}
        </h2>
        <p className="hud-label mt-1 hud-blink" style={{ color: 'rgba(0,229,255,0.5)', fontSize: 9 }}>{statusMsg}</p>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 mb-5 mt-2">
        <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.3))' }} />
        <span className="hud-label" style={{ fontSize: 8 }}>READY</span>
        <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(0,229,255,0.3), transparent)' }} />
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 w-full">
        <Link href="/chat"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium tracking-wider transition-all duration-200 rounded"
          style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)', color: '#00e5ff' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,255,0.2)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(0,229,255,0.2)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,255,0.1)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
          <MessageSquare size={13} /> CHAT
        </Link>
        <Link href="/voice"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium tracking-wider transition-all duration-200 rounded"
          style={{ background: 'rgba(255,160,0,0.08)', border: '1px solid rgba(255,160,0,0.25)', color: '#ffa000' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,160,0,0.15)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,160,0,0.08)' }}>
          <Mic size={13} /> VOICE
        </Link>
        <Link href="/automations"
          className="flex items-center justify-center px-3 py-2.5 text-xs transition-all duration-200 rounded"
          style={{ background: 'rgba(123,97,255,0.1)', border: '1px solid rgba(123,97,255,0.25)', color: '#7b61ff' }}>
          <Zap size={13} />
        </Link>
      </div>

      {/* Bottom data bar */}
      <div className="absolute bottom-3 left-3 right-3 flex justify-between">
        <span className="hud-label" style={{ fontSize: 8, opacity: 0.3 }}>LAT: 28.6139°N</span>
        <span className="hud-label" style={{ fontSize: 8, opacity: 0.3 }}>77.2090°E</span>
      </div>
    </div>
  )
}
