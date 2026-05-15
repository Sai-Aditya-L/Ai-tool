'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import {
  AlertOctagon,
  Shield,
  Zap,
  Bot,
  Brain,
  Database,
  Download,
  Eye,
  Power,
  RefreshCw,
  Check,
  X,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatRelativeTime } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface IntegrationStatus {
  status: 'connected' | 'disconnected' | 'error' | 'coming_soon' | 'future'
  metadata?: { email?: string; name?: string }
  connectedAt?: string
}

interface ActivityLog {
  id: string
  action: string
  entityType?: string
  details?: string
  createdAt: string
}

interface Automation {
  id: string
  name: string
  status: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DISPLAYED_INTEGRATIONS = [
  { id: 'google',         name: 'Google',         icon: '🔵', description: 'Calendar + Gmail' },
  { id: 'github',         name: 'GitHub',         icon: '⚫', description: 'Repositories & PRs' },
  { id: 'spotify',        name: 'Spotify',        icon: '🟢', description: 'Music control' },
  { id: 'home_assistant', name: 'Home Assistant', icon: '🏠', description: 'Smart home' },
]

const ACTION_COLORS: Record<string, string> = {
  EMERGENCY_STOP: 'text-red-400',
  DATA_EXPORT:    'text-cyan-400',
  LOGIN:          'text-green-400',
  LOGOUT:         'text-yellow-400',
  INTEGRATION_CONNECTED:    'text-violet-400',
  INTEGRATION_DISCONNECTED: 'text-orange-400',
}

// ─── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5 rounded-full border transition-all duration-200 flex-shrink-0 ${
        enabled ? 'bg-cyan-400/40 border-cyan-400/50' : 'bg-white/10 border-white/20'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${
          enabled ? 'left-5 bg-cyan-400' : 'left-0.5 bg-white/40'
        }`}
      />
    </button>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TrustCenterPage() {
  const [stopResult, setStopResult]               = useState('')
  const [emergencyStopping, setEmergencyStopping] = useState(false)
  const [integrations, setIntegrations]           = useState<Record<string, IntegrationStatus>>({})
  const [agentStats, setAgentStats]               = useState({ active: 0, completedToday: 0, failedToday: 0 })
  const [automationStats, setAutomationStats]     = useState({ active: 0, paused: 0 })
  const [automations, setAutomations]             = useState<Automation[]>([])
  const [memoryCount, setMemoryCount]             = useState(0)
  const [memoryEnabled, setMemoryEnabled]         = useState(true)
  const [dataStats, setDataStats]                 = useState({ tasks: 0, notes: 0, memories: 0, conversations: 0 })
  const [recentEvents, setRecentEvents]           = useState<ActivityLog[]>([])
  const [loading, setLoading]                     = useState(true)
  const [exporting, setExporting]                 = useState(false)
  const [pausingAll, setPausingAll]               = useState(false)
  const [resumingAll, setResumingAll]             = useState(false)
  const [clearingMemory, setClearingMemory]       = useState(false)
  const [confirmClearMemory, setConfirmClearMemory] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.allSettled([
      fetchIntegrations(),
      fetchAgentStats(),
      fetchAutomations(),
      fetchMemory(),
      fetchSettings(),
      fetchDataStats(),
      fetchRecentEvents(),
    ])
    setLoading(false)
  }

  async function fetchIntegrations() {
    try {
      const res = await fetch('/api/integrations/status')
      const data = await res.json()
      setIntegrations(data.integrations || {})
    } catch {}
  }

  async function fetchAgentStats() {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const res = await fetch('/api/agents')
      const data = await res.json()
      // Get agent run counts by fetching runs for each agent
      // We count by looking across all agent data
      const agents = data.agents || []
      // Fetch all recent runs via activity logs since there's no runs endpoint
      setAgentStats({ active: 0, completedToday: 0, failedToday: 0 })
    } catch {}
  }

  async function fetchAutomations() {
    try {
      const res = await fetch('/api/automations')
      const data = await res.json()
      const list: Automation[] = data.automations || []
      setAutomations(list)
      const active = list.filter(a => a.status === 'active').length
      const paused = list.filter(a => a.status === 'paused').length
      setAutomationStats({ active, paused })
    } catch {}
  }

  async function fetchMemory() {
    try {
      const res = await fetch('/api/memory')
      const data = await res.json()
      setMemoryCount((data.memories || []).length)
    } catch {}
  }

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      setMemoryEnabled(data.preferences?.memoryEnabled ?? true)
    } catch {}
  }

  async function fetchDataStats() {
    try {
      const [tasks, notes, memories, convos] = await Promise.allSettled([
        fetch('/api/tasks').then(r => r.json()),
        fetch('/api/notes').then(r => r.json()),
        fetch('/api/memory').then(r => r.json()),
        fetch('/api/conversations').then(r => r.json()),
      ])
      setDataStats({
        tasks:         tasks.status         === 'fulfilled' ? (tasks.value.tasks         || []).length : 0,
        notes:         notes.status         === 'fulfilled' ? (notes.value.notes         || []).length : 0,
        memories:      memories.status      === 'fulfilled' ? (memories.value.memories   || []).length : 0,
        conversations: convos.status        === 'fulfilled' ? (convos.value.conversations || []).length : 0,
      })
    } catch {}
  }

  async function fetchRecentEvents() {
    try {
      const res = await fetch('/api/activity?limit=10')
      const data = await res.json()
      setRecentEvents(data.logs || [])
    } catch {}
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleEmergencyStop() {
    if (emergencyStopping) return
    setEmergencyStopping(true)
    setStopResult('')
    try {
      const res = await fetch('/api/trust-center/emergency-stop', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setStopResult(data.message)
      toast.success('Emergency stop executed')
      await fetchAutomations()
      await fetchAgentStats()
    } catch (err: any) {
      setStopResult('Error: ' + (err.message || 'Failed to trigger emergency stop'))
      toast.error('Emergency stop failed')
    } finally {
      setEmergencyStopping(false)
    }
  }

  async function handlePauseAll() {
    setPausingAll(true)
    try {
      const active = automations.filter(a => a.status === 'active')
      await Promise.all(
        active.map(a =>
          fetch(`/api/automations/${a.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paused' }),
          })
        )
      )
      toast.success(`Paused ${active.length} automation${active.length !== 1 ? 's' : ''}`)
      await fetchAutomations()
    } catch {
      toast.error('Failed to pause automations')
    } finally {
      setPausingAll(false)
    }
  }

  async function handleResumeAll() {
    setResumingAll(true)
    try {
      const paused = automations.filter(a => a.status === 'paused')
      await Promise.all(
        paused.map(a =>
          fetch(`/api/automations/${a.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active' }),
          })
        )
      )
      toast.success(`Resumed ${paused.length} automation${paused.length !== 1 ? 's' : ''}`)
      await fetchAutomations()
    } catch {
      toast.error('Failed to resume automations')
    } finally {
      setResumingAll(false)
    }
  }

  async function handleMemoryToggle(val: boolean) {
    setMemoryEnabled(val)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryEnabled: val }),
      })
      toast.success(`Memory ${val ? 'enabled' : 'disabled'}`)
    } catch {
      setMemoryEnabled(!val)
      toast.error('Failed to update memory setting')
    }
  }

  async function handleClearMemory() {
    if (!confirmClearMemory) {
      setConfirmClearMemory(true)
      return
    }
    setClearingMemory(true)
    setConfirmClearMemory(false)
    try {
      await fetch('/api/memory', { method: 'DELETE' })
      setMemoryCount(0)
      toast.success('All memories cleared')
      await fetchMemory()
    } catch {
      toast.error('Failed to clear memories')
    } finally {
      setClearingMemory(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/trust-center/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nexus-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="TRUST CENTER" subtitle="Security, permissions & data control" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ── 1. Emergency Stop ─────────────────────────────────────────── */}
          <div className="hud-stat-card rounded-xl p-6 border border-red-500/20 bg-red-500/5">
            <div className="flex items-center gap-3 mb-3">
              <AlertOctagon size={20} className="text-red-400" />
              <h2 className="text-base font-semibold text-red-400">EMERGENCY STOP</h2>
              <span className="text-[10px] text-red-400/60 border border-red-400/20 rounded px-1.5 py-0.5">CRITICAL</span>
            </div>
            <p className="text-sm text-white/50 mb-4">
              Immediately halts all running agents and pauses all active automations.
            </p>
            <button
              onClick={handleEmergencyStop}
              disabled={emergencyStopping}
              className="w-full py-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-semibold hover:bg-red-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {emergencyStopping ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Stopping...
                </>
              ) : (
                '🛑 TRIGGER EMERGENCY STOP'
              )}
            </button>
            {stopResult && (
              <p className="text-xs text-red-300/70 mt-2 text-center">{stopResult}</p>
            )}
          </div>

          {/* ── 2. Connected Services ─────────────────────────────────────── */}
          <div className="hud-stat-card rounded-xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-cyan-400" />
                <h2 className="text-base font-semibold text-white/80">CONNECTED SERVICES</h2>
              </div>
              <Link
                href="/integrations"
                className="text-xs text-cyan-400/70 hover:text-cyan-400 flex items-center gap-1 transition-colors"
              >
                Manage <ExternalLink size={11} />
              </Link>
            </div>
            <div className="space-y-2">
              {DISPLAYED_INTEGRATIONS.map(svc => {
                const info = integrations[svc.id]
                const connected = info?.status === 'connected'
                return (
                  <div
                    key={svc.id}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/3 border border-white/5"
                  >
                    <span className="text-lg">{svc.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80">{svc.name}</p>
                      <p className="text-[11px] text-white/40">{svc.description}</p>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                        connected
                          ? 'text-green-400 bg-green-400/10 border-green-400/20'
                          : 'text-white/30 bg-white/5 border-white/10'
                      }`}
                    >
                      {connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 3. Active Agents ──────────────────────────────────────────── */}
          <div className="hud-stat-card rounded-xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Bot size={18} className="text-violet-400" />
                <h2 className="text-base font-semibold text-white/80">ACTIVE AGENTS</h2>
              </div>
              <Link
                href="/agents"
                className="text-xs text-cyan-400/70 hover:text-cyan-400 flex items-center gap-1 transition-colors"
              >
                View all <ExternalLink size={11} />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-white/3 border border-white/5">
                <p className="text-2xl font-bold text-violet-400">{agentStats.active}</p>
                <p className="text-[11px] text-white/40 mt-0.5">Active</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/3 border border-white/5">
                <p className="text-2xl font-bold text-green-400">{agentStats.completedToday}</p>
                <p className="text-[11px] text-white/40 mt-0.5">Done today</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/3 border border-white/5">
                <p className="text-2xl font-bold text-red-400">{agentStats.failedToday}</p>
                <p className="text-[11px] text-white/40 mt-0.5">Failed today</p>
              </div>
            </div>
            <p className="text-[11px] text-white/30 mt-3 text-center">
              Manage agent runs and approvals from the Agents page
            </p>
          </div>

          {/* ── 4. Automation Controls ────────────────────────────────────── */}
          <div className="hud-stat-card rounded-xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Zap size={18} className="text-yellow-400" />
                <h2 className="text-base font-semibold text-white/80">AUTOMATION CONTROLS</h2>
              </div>
              <Link
                href="/automations"
                className="text-xs text-cyan-400/70 hover:text-cyan-400 flex items-center gap-1 transition-colors"
              >
                View all <ExternalLink size={11} />
              </Link>
            </div>
            <div className="flex gap-3 mb-4">
              <div className="flex-1 text-center p-3 rounded-lg bg-white/3 border border-white/5">
                <p className="text-2xl font-bold text-green-400">{automationStats.active}</p>
                <p className="text-[11px] text-white/40 mt-0.5">Active</p>
              </div>
              <div className="flex-1 text-center p-3 rounded-lg bg-white/3 border border-white/5">
                <p className="text-2xl font-bold text-yellow-400">{automationStats.paused}</p>
                <p className="text-[11px] text-white/40 mt-0.5">Paused</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePauseAll}
                disabled={pausingAll || automationStats.active === 0}
                className="flex-1 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {pausingAll ? <RefreshCw size={12} className="animate-spin" /> : <Power size={12} />}
                Pause All
              </button>
              <button
                onClick={handleResumeAll}
                disabled={resumingAll || automationStats.paused === 0}
                className="flex-1 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {resumingAll ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Resume All
              </button>
            </div>
          </div>

          {/* ── 5. Memory Controls ────────────────────────────────────────── */}
          <div className="hud-stat-card rounded-xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Brain size={18} className="text-pink-400" />
                <h2 className="text-base font-semibold text-white/80">MEMORY CONTROLS</h2>
              </div>
              <Link
                href="/memory"
                className="text-xs text-cyan-400/70 hover:text-cyan-400 flex items-center gap-1 transition-colors"
              >
                View memories <ExternalLink size={11} />
              </Link>
            </div>

            <div className="flex items-center justify-between py-3 px-3 rounded-lg bg-white/3 border border-white/5 mb-3">
              <div>
                <p className="text-sm text-white/80">Memory enabled</p>
                <p className="text-[11px] text-white/40">NEXUS learns from your interactions</p>
              </div>
              <Toggle enabled={memoryEnabled} onChange={handleMemoryToggle} />
            </div>

            <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/3 border border-white/5 mb-3">
              <p className="text-sm text-white/60">
                Stored memories: <span className="text-pink-400 font-semibold">{memoryCount}</span>
              </p>
            </div>

            <button
              onClick={handleClearMemory}
              disabled={clearingMemory || memoryCount === 0}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                confirmClearMemory
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10'
              }`}
            >
              {clearingMemory ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <X size={13} />
              )}
              {confirmClearMemory ? 'Confirm — Clear All Memories?' : 'Clear All Memories'}
            </button>
            {confirmClearMemory && (
              <p className="text-[11px] text-red-400/60 mt-1.5 text-center">
                Click again to confirm. This cannot be undone.
              </p>
            )}
          </div>

          {/* ── 6. Data Controls ──────────────────────────────────────────── */}
          <div className="hud-stat-card rounded-xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Database size={18} className="text-cyan-400" />
                <h2 className="text-base font-semibold text-white/80">DATA CONTROLS</h2>
              </div>
              <Link
                href="/activity"
                className="text-xs text-cyan-400/70 hover:text-cyan-400 flex items-center gap-1 transition-colors"
              >
                Activity log <ExternalLink size={11} />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: 'Tasks',         value: dataStats.tasks,         color: 'text-green-400' },
                { label: 'Notes',         value: dataStats.notes,         color: 'text-pink-400' },
                { label: 'Memories',      value: dataStats.memories,      color: 'text-violet-400' },
                { label: 'Conversations', value: dataStats.conversations, color: 'text-cyan-400' },
              ].map(stat => (
                <div key={stat.label} className="py-2 px-3 rounded-lg bg-white/3 border border-white/5 text-center">
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {exporting ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              {exporting ? 'Exporting...' : 'Export All Data as JSON'}
            </button>
          </div>

          {/* ── 7. Permission Overview ────────────────────────────────────── */}
          <div className="hud-stat-card rounded-xl p-6 border border-white/5 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Eye size={18} className="text-white/60" />
              <h2 className="text-base font-semibold text-white/80">PERMISSION OVERVIEW</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                { icon: Check, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/15', text: 'Read your tasks, reminders, notes' },
                { icon: Check, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/15', text: 'Create tasks/reminders from your voice/chat' },
                { icon: Check, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/15', text: 'Connect to Google Calendar (if authorized)' },
                { icon: Check, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/15', text: 'Read Gmail (if authorized)' },
                { icon: null,  color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/15', emoji: '⚠️', text: 'Send emails ONLY after explicit approval' },
                { icon: null,  color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/15', emoji: '⚠️', text: 'Delete data ONLY after explicit confirmation' },
                { icon: null,  color: 'text-cyan-400',   bg: 'bg-cyan-400/10',   border: 'border-cyan-400/15',   emoji: '🛡️', text: 'Never shares your data with third parties' },
                { icon: null,  color: 'text-cyan-400',   bg: 'bg-cyan-400/10',   border: 'border-cyan-400/15',   emoji: '🛡️', text: 'All AI processing uses your configured provider' },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 py-2.5 px-3 rounded-lg ${item.bg} border ${item.border}`}
                >
                  {item.icon ? (
                    <item.icon size={13} className={`${item.color} mt-0.5 flex-shrink-0`} />
                  ) : (
                    <span className="text-[13px] flex-shrink-0 mt-0.5">{item.emoji}</span>
                  )}
                  <p className={`text-xs ${item.color} leading-relaxed`}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 8. Recent Security Events ─────────────────────────────────── */}
          <div className="hud-stat-card rounded-xl p-6 border border-white/5 md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-white/60" />
                <h2 className="text-base font-semibold text-white/80">RECENT SECURITY EVENTS</h2>
              </div>
              <Link
                href="/activity"
                className="text-xs text-cyan-400/70 hover:text-cyan-400 flex items-center gap-1 transition-colors"
              >
                Full log <ExternalLink size={11} />
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw size={16} className="animate-spin text-white/30" />
              </div>
            ) : recentEvents.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-6">No recent events</p>
            ) : (
              <div className="space-y-1.5">
                {recentEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 py-2 px-3 rounded-lg bg-white/3 border border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-mono font-semibold ${
                            ACTION_COLORS[event.action] || 'text-white/60'
                          }`}
                        >
                          {event.action}
                        </span>
                        {event.entityType && (
                          <span className="text-[10px] text-white/30 border border-white/10 rounded px-1 py-0.5">
                            {event.entityType}
                          </span>
                        )}
                      </div>
                      {event.details && (
                        <p className="text-[11px] text-white/40 mt-0.5 truncate">{event.details}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-white/25 flex-shrink-0 mt-0.5">
                      {formatRelativeTime(event.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
