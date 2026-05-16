'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, GripHorizontal, Clock, Target, Zap, Brain } from 'lucide-react'

interface OverlayData {
  time: string
  nextTask: string
  score: number | null
  streak: number
}

export function NexusHudOverlay() {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 16, y: 16 })
  const [data, setData] = useState<OverlayData>({ time: '', nextTask: 'Loading…', score: null, streak: 0 })
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Keyboard toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault()
        setVisible(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Clock tick
  useEffect(() => {
    if (!visible) return
    const tick = () => setData(d => ({ ...d, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [visible])

  // Load productivity data
  const loadData = useCallback(async () => {
    if (!visible) return
    try {
      const [prodRes, taskRes] = await Promise.all([
        fetch('/api/analytics/productivity'),
        fetch('/api/tasks?status=pending&limit=1'),
      ])
      if (prodRes.ok) {
        const prod = await prodRes.json()
        setData(d => ({ ...d, score: prod.score, streak: prod.streak }))
      }
      if (taskRes.ok) {
        const tasks = await taskRes.json()
        const next = tasks.tasks?.[0]?.title || tasks[0]?.title
        setData(d => ({ ...d, nextTask: next || 'No pending tasks' }))
      }
    } catch {}
  }, [visible])

  useEffect(() => { loadData() }, [loadData])

  // Drag
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y })
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  if (!visible) return null

  return (
    <div
      ref={containerRef}
      className="fixed z-[200] select-none"
      style={{ left: pos.x, top: pos.y, width: 220 }}
    >
      <div className="rounded-xl border border-cyan-400/20 overflow-hidden" style={{ background: 'rgba(0,4,12,0.92)', backdropFilter: 'blur(12px)' }}>
        {/* Header drag bar */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-white/5 cursor-grab active:cursor-grabbing"
          onMouseDown={onMouseDown}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="hud-label text-xs" style={{ fontSize: 9 }}>NEXUS HUD</span>
          </div>
          <div className="flex items-center gap-2">
            <GripHorizontal size={10} className="text-white/20" />
            <button onClick={() => setVisible(false)} className="text-white/20 hover:text-white/60 transition-colors">
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-cyan-400 flex-shrink-0" />
            <span className="text-white font-mono text-sm">{data.time || '--:--:--'}</span>
          </div>
          <div className="flex items-start gap-2">
            <Target size={12} className="text-green-400 flex-shrink-0 mt-0.5" />
            <span className="text-white/70 text-xs leading-tight truncate">{data.nextTask}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-amber-400 flex-shrink-0" />
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-700"
                style={{ width: `${data.score ?? 0}%` }}
              />
            </div>
            <span className="text-amber-400 text-xs font-bold w-6 text-right">{data.score ?? '--'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Brain size={12} className="text-violet-400 flex-shrink-0" />
            <span className="text-white/50 text-xs">{data.streak}d streak</span>
          </div>
        </div>

        <div className="px-3 pb-2">
          <p className="text-white/20 text-xs">Ctrl+Shift+H to hide</p>
        </div>
      </div>
    </div>
  )
}
