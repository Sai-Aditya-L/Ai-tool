'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Bell, Brain, Check, Loader2, AlertTriangle, Info, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

interface ProactiveAlert {
  id: string
  title: string
  body: string
  type: string
  createdAt: string
  read: boolean
}

// Parse priority from body string like "[HIGH] message text"
function parsePriority(body: string): string {
  const match = body.match(/^\[([A-Z]+)\]/)
  if (!match) return 'medium'
  const p = match[1].toLowerCase()
  if (['critical', 'high', 'medium', 'low'].includes(p)) return p
  return 'medium'
}

function parseMessage(body: string): string {
  return body.replace(/^\[[A-Z]+\]\s*/, '')
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts/analyze')
      const data = await res.json()
      if (data.alerts) setAlerts(data.alerts)
    } catch {}
    setLoading(false)
  }

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/alerts/analyze', { method: 'POST' })
      const data = await res.json()
      if (data.skipped) {
        toast('Analysis ran recently — check back in 30 min', { icon: '⏱️' })
      } else if (data.alerts?.length === 0) {
        toast.success('All clear! No urgent alerts detected.')
      } else {
        toast.success(`${data.alerts.length} new alert(s) generated`)
      }
      fetchAlerts()
    } catch {
      toast.error('Analysis failed')
    }
    setAnalyzing(false)
  }

  const dismissAlert = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      })
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch {}
  }

  useEffect(() => { fetchAlerts() }, [])

  const getPriorityIcon = (body: string) => {
    const priority = parsePriority(body)
    if (priority === 'critical') return <AlertTriangle size={14} className="text-red-400" />
    if (priority === 'high') return <Zap size={14} className="text-amber-400" />
    if (priority === 'medium') return <Bell size={14} className="text-cyan-400" />
    return <Info size={14} className="text-white/40" />
  }

  const getPriorityColor = (body: string) => {
    const priority = parsePriority(body)
    if (priority === 'critical') return 'border-red-400/30 bg-red-400/5'
    if (priority === 'high') return 'border-amber-400/30 bg-amber-400/5'
    if (priority === 'medium') return 'border-cyan-400/20 bg-cyan-400/5'
    return 'border-white/10 bg-white/3'
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    if (h > 0) return `${h}h ago`
    return m < 1 ? 'just now' : `${m}m ago`
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Proactive Alerts" subtitle="NEXUS monitors your system and alerts you proactively" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[800px] mx-auto">
          {/* Header action */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-400/10 border border-violet-400/20 flex items-center justify-center">
                <Brain size={18} className="text-violet-400" />
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium">AI-Powered Monitoring</p>
                <p className="text-white/30 text-xs">NEXUS analyzes your tasks, reminders & calendar</p>
              </div>
            </div>
            <button onClick={runAnalysis} disabled={analyzing}
              className="flex items-center gap-2 nexus-btn-primary text-sm py-2">
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
              {analyzing ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="hud-panel rounded-xl p-4 h-20 animate-pulse" />)}
            </div>
          ) : alerts.length === 0 ? (
            <div className="hud-panel hud-panel-inner rounded-xl p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-green-400/10 border border-green-400/20 flex items-center justify-center mx-auto mb-4">
                <Check size={24} className="text-green-400" />
              </div>
              <h3 className="text-white/70 font-medium mb-2">All Clear</h3>
              <p className="text-white/30 text-sm">No active alerts. Run an analysis to check for anything urgent.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => {
                const priority = parsePriority(alert.body)
                const message = parseMessage(alert.body)
                return (
                <div key={alert.id}
                  className={`hud-panel hud-panel-inner rounded-xl p-4 border ${getPriorityColor(alert.body)}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getPriorityIcon(alert.body)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white/90 text-sm font-medium">{alert.title}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded nexus-mono ${
                          priority === 'critical' ? 'text-red-400 bg-red-400/10' :
                          priority === 'high' ? 'text-amber-400 bg-amber-400/10' :
                          'text-cyan-400 bg-cyan-400/10'}`}>
                          {priority.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-white/50 text-sm">{message}</p>
                      <p className="text-white/20 text-xs mt-1.5 nexus-mono">{timeAgo(alert.createdAt)}</p>
                    </div>
                    <button onClick={() => dismissAlert(alert.id)}
                      className="text-white/20 hover:text-white/60 transition-colors p-1 rounded">
                      <Check size={14} />
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
