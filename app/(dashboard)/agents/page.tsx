'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Header } from '@/components/layout/header'
import {
  Bot,
  Plus,
  Play,
  Trash2,
  Eye,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Zap,
  Activity,
  Layers,
  Send,
} from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Agent {
  id: string
  name: string
  role: string
  description?: string | null
  systemPrompt?: string | null
  model: string
  avatar?: string | null
  status?: string
  _count?: { runs: number }
}

interface AgentRun {
  id: string
  agentId: string
  task: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'needs_approval'
  output?: string | null
  createdAt: string
  updatedAt: string
  _count?: { logs: number }
}

interface AgentLog {
  id: string
  type: 'info' | 'tool_use' | 'tool_result' | 'thinking' | 'output' | 'error' | 'approval_needed'
  content: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PRESET_AGENTS = [
  { name: 'Atlas',         role: 'Travel Agent',        description: 'Plans trips, routes, and itineraries',                                      avatar: '🌍', color: 'text-blue-400' },
  { name: 'Chronos',       role: 'Calendar Agent',       description: 'Manages scheduling and time planning',                                       avatar: '⏱️', color: 'text-cyan-400' },
  { name: 'Hermes',        role: 'Communication Agent',  description: 'Handles emails and messaging workflows',                                      avatar: '📡', color: 'text-violet-400' },
  { name: 'Forge',         role: 'Coding Agent',         description: 'Reviews code, generates docs, debug assistance',                             avatar: '⚙️', color: 'text-orange-400' },
  { name: 'Sentinel',      role: 'Security Agent',       description: 'Monitors security and access patterns',                                       avatar: '🛡️', color: 'text-red-400' },
  { name: 'Ledger',        role: 'Finance Agent',        description: 'Tracks expenses, bills, and financial goals',                                 avatar: '💳', color: 'text-green-400' },
  { name: 'Oracle',        role: 'Research Agent',       description: 'Deep research, synthesis, and analysis',                                      avatar: '🔮', color: 'text-pink-400' },
  { name: 'Echo',          role: 'Memory Agent',         description: 'Manages knowledge base and preferences',                                      avatar: '🧠', color: 'text-yellow-400' },
  { name: 'Titan',         role: 'Automation Agent',     description: 'Builds and executes workflow automations',                                    avatar: '⚡', color: 'text-indigo-400' },
  { name: 'Nova',          role: 'Creative Agent',       description: 'Generates creative content, brainstorms ideas, writes stories and scripts',   avatar: '✨', color: 'text-pink-400' },
  { name: 'Pulse',         role: 'Health Agent',         description: 'Tracks wellness goals, fitness routines, sleep, and healthy habits',          avatar: '💚', color: 'text-green-400' },
  { name: 'Cipher',        role: 'Crypto Agent',         description: 'Analyzes encryption, security protocols, and cryptographic systems',           avatar: '🔐', color: 'text-red-400' },
  { name: 'Scribe',        role: 'Writing Agent',        description: 'Drafts documents, polishes prose, summarizes long-form content',              avatar: '📝', color: 'text-amber-400' },
  { name: 'Maven',         role: 'Learning Agent',       description: 'Creates study plans, explains concepts, generates quizzes and flashcards',    avatar: '🎓', color: 'text-violet-400' },
  { name: 'Cartographer',  role: 'Mapping Agent',        description: 'Analyzes locations, plans routes, researches places and geography',           avatar: '🗺️', color: 'text-sky-400' },
  { name: 'Beacon',        role: 'Notification Agent',   description: 'Manages alerts, prioritizes notifications, and sends smart digests',          avatar: '📡', color: 'text-cyan-400' },
  { name: 'Nimbus',        role: 'Environment Agent',    description: 'Tracks weather, air quality, climate data, and environmental conditions',     avatar: '🌤️', color: 'text-blue-400' },
]

const MODELS = [
  { value: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-7',            label: 'Claude Opus 4.7' },
  { value: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5' },
]

// ─── Status helpers ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status?: string }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-cyan-400">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        running
      </span>
    )
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
        <span className="w-2 h-2 rounded-full bg-green-400" />
        completed
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        failed
      </span>
    )
  }
  if (status === 'needs_approval') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400">
        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        approval needed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-white/40">
      <span className="w-2 h-2 rounded-full bg-white/30" />
      idle
    </span>
  )
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed:      'text-green-400 bg-green-400/10 border-green-400/20',
    running:        'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    failed:         'text-red-400 bg-red-400/10 border-red-400/20',
    needs_approval: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    pending:        'text-white/40 bg-white/5 border-white/10',
  }
  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', map[status] ?? map.pending)}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ─── Log type icon/colour ──────────────────────────────────────────────────────

function LogEntry({ log }: { log: AgentLog }) {
  const iconMap: Record<string, { icon: string; cls: string }> = {
    info:             { icon: 'ℹ',  cls: 'text-cyan-400' },
    tool_use:         { icon: '⚡', cls: 'text-violet-400' },
    tool_result:      { icon: '✓',  cls: 'text-green-400' },
    thinking:         { icon: '…',  cls: 'text-white/30' },
    output:           { icon: '💬', cls: 'text-cyan-300' },
    error:            { icon: '✗',  cls: 'text-red-400' },
    approval_needed:  { icon: '⚠',  cls: 'text-yellow-400' },
  }
  const { icon, cls } = iconMap[log.type] ?? { icon: '·', cls: 'text-white/40' }
  const toolName = log.type === 'tool_use' && log.metadata?.tool
    ? ` [${log.metadata.tool}]`
    : ''

  return (
    <div className="flex gap-2 py-1.5 border-b border-white/5 last:border-0">
      <span className={cn('text-xs flex-shrink-0 w-4 text-center leading-5', cls)}>{icon}</span>
      <div className="flex-1 min-w-0">
        <span className={cn('text-xs', cls === 'text-white/30' ? 'text-white/30 italic' : 'text-white/70')}>
          {log.content}{toolName}
        </span>
        <span className="block text-[10px] text-white/25 mt-0.5 nexus-mono">
          {formatRelativeTime(log.createdAt)}
        </span>
      </div>
    </div>
  )
}

// ─── Log Viewer Modal ──────────────────────────────────────────────────────────

interface LogViewerProps {
  agentId: string
  run: AgentRun
  onClose: () => void
  onApprovalAction: (runId: string, approved: boolean) => Promise<void>
}

function LogViewer({ agentId, run, onClose, onApprovalAction }: LogViewerProps) {
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [loading, setLoading] = useState(true)
  const [liveRun, setLiveRun] = useState<AgentRun>(run)
  const [approving, setApproving] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/runs/${run.id}`)
      if (!res.ok) return
      const data = await res.json()
      setLiveRun(data.run)
      setLogs(data.logs ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [agentId, run.id])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Poll while running
  useEffect(() => {
    if (liveRun.status === 'running' || liveRun.status === 'pending') {
      pollingRef.current = setTimeout(async () => {
        await fetchLogs()
      }, 3000)
    }
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current)
    }
  }, [liveRun.status, logs, fetchLogs])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  async function handleApproval(approved: boolean) {
    setApproving(true)
    try {
      await onApprovalAction(run.id, approved)
      await fetchLogs()
    } finally {
      setApproving(false)
    }
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={handleBackdrop}
    >
      <div className="glass-panel rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Activity size={14} className="text-cyan-400" />
              Run Logs
            </h3>
            <p className="text-white/40 text-xs mt-0.5 nexus-mono truncate max-w-md">{run.task}</p>
          </div>
          <div className="flex items-center gap-3">
            <RunStatusBadge status={liveRun.status} />
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-cyan-400/60" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-white/25 text-xs text-center py-10">No logs yet</p>
          ) : (
            <div>
              {logs.map(log => <LogEntry key={log.id} log={log} />)}
              {(liveRun.status === 'running' || liveRun.status === 'pending') && (
                <div className="flex items-center gap-2 py-2 text-white/25 text-xs">
                  <Loader2 size={11} className="animate-spin" />
                  Agent is working…
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Output */}
        {liveRun.output && liveRun.status === 'completed' && (
          <div className="border-t border-white/5 px-5 py-3">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Output</p>
            <p className="text-white/70 text-xs leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
              {liveRun.output}
            </p>
          </div>
        )}

        {/* Approval panel */}
        {liveRun.status === 'needs_approval' && (
          <div className="border-t border-yellow-400/15 px-5 py-3 bg-yellow-400/5 flex items-center gap-3">
            <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
            <p className="text-yellow-400 text-xs flex-1">This run requires your approval to continue.</p>
            <button
              onClick={() => handleApproval(false)}
              disabled={approving}
              className="nexus-btn-secondary text-xs px-3 py-1.5 text-red-400 border-red-400/20 hover:border-red-400/40"
            >
              Reject
            </button>
            <button
              onClick={() => handleApproval(true)}
              disabled={approving}
              className="nexus-btn-primary text-xs px-3 py-1.5"
            >
              {approving ? <Loader2 size={12} className="animate-spin" /> : 'Approve'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Run Task Modal ────────────────────────────────────────────────────────────

interface RunTaskModalProps {
  agent: Agent
  onClose: () => void
  onRunStarted: (run: AgentRun) => void
}

function RunTaskModal({ agent, onClose, onRunStarted }: RunTaskModalProps) {
  const [task, setTask] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!task.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: task.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to start run')
      }
      const data = await res.json()
      toast.success(`${agent.name} is on it!`)
      onRunStarted(data.run)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start run')
    } finally {
      setSubmitting(false)
    }
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={handleBackdrop}
    >
      <div className="glass-panel rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="text-lg">{agent.avatar || agent.name.charAt(0)}</span>
              Run Task with {agent.name}
            </h3>
            <p className="text-white/40 text-xs mt-0.5">{agent.role}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            rows={4}
            placeholder="Describe what you want this agent to do…"
            value={task}
            onChange={e => setTask(e.target.value)}
            required
            autoFocus
            className="nexus-input resize-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !task.trim()}
              className="nexus-btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Dispatching…
                </>
              ) : (
                <>
                  <Play size={14} />
                  Run Task
                </>
              )}
            </button>
            <button type="button" onClick={onClose} className="nexus-btn-secondary px-4">
              <X size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Agent Runs Panel ──────────────────────────────────────────────────────────

interface AgentRunsPanelProps {
  agent: Agent
  onClose: () => void
  refreshTrigger: number
}

function AgentRunsPanel({ agent, onClose, refreshTrigger }: AgentRunsPanelProps) {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingRun, setViewingRun] = useState<AgentRun | null>(null)

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agent.id}/runs`)
      if (!res.ok) return
      const data = await res.json()
      setRuns(data.runs ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [agent.id])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns, refreshTrigger])

  async function handleApprovalAction(runId: string, approved: boolean) {
    try {
      const res = await fetch(`/api/agents/${agent.id}/runs/${runId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      })
      if (!res.ok) throw new Error()
      toast.success(approved ? 'Run approved' : 'Run rejected')
      await fetchRuns()
    } catch {
      toast.error('Failed to submit approval')
    }
  }

  return (
    <>
      <div className="glass-panel rounded-2xl mt-2 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Activity size={13} className="text-cyan-400" />
            <span className="text-white/80 text-sm font-medium">Recent Runs — {agent.name}</span>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white/60 transition-colors">
            <X size={14} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-cyan-400/50" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-8">
            <Zap size={28} className="text-white/15 mx-auto mb-2" />
            <p className="text-white/30 text-sm">No runs yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {runs.slice(0, 5).map(run => (
              <div key={run.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-white/75 text-xs truncate max-w-xs">{run.task}</p>
                  <p className="text-white/30 text-[10px] mt-0.5 nexus-mono">
                    {formatRelativeTime(run.createdAt)}
                  </p>
                </div>
                <RunStatusBadge status={run.status} />
                <button
                  onClick={() => setViewingRun(run)}
                  className="text-white/30 hover:text-cyan-400 transition-colors flex-shrink-0 flex items-center gap-1 text-xs"
                  title="View logs"
                >
                  <Eye size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingRun && (
        <LogViewer
          agentId={agent.id}
          run={viewingRun}
          onClose={() => setViewingRun(null)}
          onApprovalAction={handleApprovalAction}
        />
      )}
    </>
  )
}

// ─── Agent Row ─────────────────────────────────────────────────────────────────

interface AgentRowProps {
  agent: Agent
  onDelete: (id: string) => void
  onRunTask: (agent: Agent) => void
  runRefreshTrigger: number
}

function AgentRow({ agent, onDelete, onRunTask, runRefreshTrigger }: AgentRowProps) {
  const [showRuns, setShowRuns] = useState(false)
  const avatarChar = agent.avatar || agent.name.charAt(0).toUpperCase()

  return (
    <div className="glass-panel-hover rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-white/5 border border-white/8 flex-shrink-0">
          {agent.avatar ? agent.avatar : (
            <span className="text-cyan-400 font-bold text-sm">{avatarChar}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/90 text-sm font-medium">{agent.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-400/15 text-cyan-400/70 bg-cyan-400/5">
              {agent.role}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <StatusDot status={agent.status} />
            {agent._count && (
              <span className="text-white/25 text-[10px] nexus-mono">{agent._count.runs} run{agent._count.runs !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onRunTask(agent)}
            title="Run Task"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/5 text-cyan-400 hover:bg-cyan-400/10 hover:border-cyan-400/40 transition-all text-xs"
          >
            <Play size={11} />
            Run
          </button>
          <button
            onClick={() => setShowRuns(v => !v)}
            title={showRuns ? 'Hide runs' : 'View runs'}
            className={cn(
              'p-1.5 rounded-lg border transition-all text-white/40 hover:text-cyan-400',
              showRuns
                ? 'border-cyan-400/25 bg-cyan-400/5 text-cyan-400'
                : 'border-white/8 hover:border-cyan-400/20'
            )}
          >
            {showRuns ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <button
            onClick={() => onDelete(agent.id)}
            title="Delete agent"
            className="p-1.5 rounded-lg border border-white/8 text-white/25 hover:text-red-400 hover:border-red-400/20 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {showRuns && (
        <div className="px-4 pb-3">
          <AgentRunsPanel
            agent={agent}
            onClose={() => setShowRuns(false)}
            refreshTrigger={runRefreshTrigger}
          />
        </div>
      )}
    </div>
  )
}

// ─── Preset Card ───────────────────────────────────────────────────────────────

interface PresetCardProps {
  preset: typeof PRESET_AGENTS[number]
  onDeploy: (preset: typeof PRESET_AGENTS[number]) => void
}

function PresetCard({ preset, onDeploy }: PresetCardProps) {
  return (
    <div className="glass-panel-hover rounded-xl p-4 flex flex-col gap-2.5 group cursor-default">
      <div className="flex items-start justify-between">
        <span className="text-2xl leading-none">{preset.avatar}</span>
        <span className={cn('text-[10px] nexus-mono font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/8', preset.color)}>
          {preset.role}
        </span>
      </div>
      <div>
        <p className="text-white/85 text-sm font-semibold">{preset.name}</p>
        <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{preset.description}</p>
      </div>
      <button
        onClick={() => onDeploy(preset)}
        className="mt-auto w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/8 text-white/50 text-xs hover:text-cyan-400 hover:border-cyan-400/25 hover:bg-cyan-400/5 transition-all"
      >
        <Plus size={12} />
        Deploy
      </button>
    </div>
  )
}

// ─── Create Agent Form ─────────────────────────────────────────────────────────

interface CreateFormProps {
  initial?: { name: string; role: string; avatar?: string }
  onClose: () => void
  onCreated: (agent: Agent) => void
}

function CreateAgentForm({ initial, onClose, onCreated }: CreateFormProps) {
  const [form, setForm] = useState({
    name:         initial?.name        ?? '',
    role:         initial?.role        ?? '',
    description:  '',
    systemPrompt: '',
    model:        'claude-sonnet-4-6',
    avatar:       initial?.avatar      ?? '',
  })
  const [saving, setSaving] = useState(false)

  // Sync if preset changes while form is open
  useEffect(() => {
    if (initial) {
      setForm(f => ({
        ...f,
        name:   initial.name,
        role:   initial.role,
        avatar: initial.avatar ?? '',
      }))
    }
  }, [initial?.name, initial?.role])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.role.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:         form.name.trim(),
          role:         form.role.trim(),
          description:  form.description.trim() || null,
          systemPrompt: form.systemPrompt.trim() || null,
          model:        form.model,
          avatar:       form.avatar.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to create agent')
      }
      const data = await res.json()
      toast.success(`${data.agent.name} deployed!`)
      onCreated(data.agent)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create agent')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Bot size={15} className="text-cyan-400" />
          Deploy New Agent
        </h3>
        <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Agent name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            autoFocus
            className="nexus-input"
          />
          <input
            type="text"
            placeholder="Role *  (e.g. Travel Agent)"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            required
            className="nexus-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Avatar emoji  (optional)"
            value={form.avatar}
            onChange={e => setForm(f => ({ ...f, avatar: e.target.value }))}
            className="nexus-input"
          />
          <select
            value={form.model}
            onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
            className="nexus-input"
          >
            {MODELS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <textarea
          placeholder="Description  (optional)"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={2}
          className="nexus-input resize-none"
        />

        <textarea
          placeholder="Custom system prompt  (optional — leave blank to use the default role-based prompt)"
          value={form.systemPrompt}
          onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
          rows={3}
          className="nexus-input resize-none"
        />

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="nexus-btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Deploying…
              </>
            ) : (
              <>
                <Bot size={14} />
                Deploy Agent
              </>
            )}
          </button>
          <button type="button" onClick={onClose} className="nexus-btn-secondary px-5">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Swarm Mode ────────────────────────────────────────────────────────────────

interface SwarmResult {
  agentName: string
  result: string
  runId: string
}

type SwarmPhase = 'idle' | 'analyzing' | 'deploying' | 'done' | 'error'

function SwarmModePanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<SwarmPhase>('idle')
  const [agents, setAgents] = useState<string[]>([])
  const [results, setResults] = useState<SwarmResult[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  async function handleDeploy() {
    if (!query.trim()) return
    setPhase('analyzing')
    setAgents([])
    setResults([])
    setErrorMsg('')

    try {
      setPhase('deploying')
      const res = await fetch('/api/agents/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Orchestration failed')
      }
      const data = await res.json()
      if (!data.orchestrated) {
        setErrorMsg('Query did not require multi-agent orchestration. Try a more complex, multi-domain query.')
        setPhase('error')
        return
      }
      setAgents(data.agents ?? [])
      setResults(data.results ?? [])
      setPhase('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Swarm deployment failed')
      setPhase('error')
    }
  }

  function handleReset() {
    setPhase('idle')
    setQuery('')
    setAgents([])
    setResults([])
    setErrorMsg('')
  }

  const statusLabel: Record<SwarmPhase, string> = {
    idle:      '',
    analyzing: 'Analyzing query…',
    deploying: agents.length > 0 ? `Deploying ${agents.join(', ')}…` : 'Deploying agents…',
    done:      `Swarm complete — ${results.length} agent${results.length !== 1 ? 's' : ''} responded`,
    error:     errorMsg,
  }

  return (
    <div className="glass-panel rounded-2xl p-5 border border-violet-400/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Layers size={15} className="text-violet-400" />
          SWARM MODE
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-400/10 border border-violet-400/20 text-violet-400 font-normal">
            Multi-Agent
          </span>
        </h3>
        <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Input */}
      <div className="space-y-3">
        <textarea
          rows={3}
          placeholder="Enter a complex, multi-domain query to deploy a swarm of specialized agents… (e.g. 'Plan a trip to Tokyo next month, book a meeting with my team, and summarize my finances')"
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={phase === 'analyzing' || phase === 'deploying'}
          className="nexus-input resize-none w-full"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleDeploy}
            disabled={!query.trim() || phase === 'analyzing' || phase === 'deploying'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-violet-400/30 bg-violet-400/10 text-violet-400 text-sm font-medium hover:bg-violet-400/20 hover:border-violet-400/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {(phase === 'analyzing' || phase === 'deploying') ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                {phase === 'analyzing' ? 'Analyzing…' : 'Deploying…'}
              </>
            ) : (
              <>
                <Send size={13} />
                DEPLOY SWARM
              </>
            )}
          </button>
          {(phase === 'done' || phase === 'error') && (
            <button onClick={handleReset} className="nexus-btn-secondary text-xs px-3 py-2">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      {phase !== 'idle' && (
        <div className={cn(
          'mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2',
          phase === 'error'
            ? 'bg-red-400/10 border border-red-400/20 text-red-400'
            : phase === 'done'
            ? 'bg-green-400/10 border border-green-400/20 text-green-400'
            : 'bg-violet-400/10 border border-violet-400/20 text-violet-300'
        )}>
          {(phase === 'analyzing' || phase === 'deploying') && (
            <Loader2 size={11} className="animate-spin flex-shrink-0" />
          )}
          {statusLabel[phase]}
        </div>
      )}

      {/* Agent badges while deploying */}
      {phase === 'deploying' && agents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {agents.map(name => (
            <span
              key={name}
              className="text-[10px] px-2 py-0.5 rounded-full border border-violet-400/20 bg-violet-400/8 text-violet-300 flex items-center gap-1"
            >
              <Loader2 size={9} className="animate-spin" />
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Results */}
      {phase === 'done' && results.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-white/40 text-[10px] uppercase tracking-widest">Agent Results</p>
          {results.map(r => (
            <div key={r.agentName} className="glass-panel rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-violet-300">{r.agentName}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-green-400/20 bg-green-400/10 text-green-400">
                  completed
                </span>
                {r.runId && (
                  <span className="text-[10px] text-white/20 nexus-mono ml-auto">
                    run:{r.runId.slice(0, 8)}
                  </span>
                )}
              </div>
              <p className="text-white/65 text-xs leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                {r.result}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [prefilledPreset, setPrefilledPreset] = useState<typeof PRESET_AGENTS[number] | null>(null)
  const [runTaskAgent, setRunTaskAgent] = useState<Agent | null>(null)
  const [runRefreshTrigger, setRunRefreshTrigger] = useState(0)
  const [showPresets, setShowPresets] = useState(true)
  const [showSwarm, setShowSwarm] = useState(false)

  useEffect(() => {
    fetchAgents()
  }, [])

  async function fetchAgents() {
    setLoading(true)
    try {
      const res = await fetch('/api/agents')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAgents(data.agents ?? [])
    } catch {
      toast.error('Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  async function deleteAgent(id: string) {
    if (!confirm('Delete this agent and all its run history?')) return
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAgents(prev => prev.filter(a => a.id !== id))
      toast.success('Agent deleted')
    } catch {
      toast.error('Failed to delete agent')
    }
  }

  function handlePresetDeploy(preset: typeof PRESET_AGENTS[number]) {
    setPrefilledPreset(preset)
    setShowCreateForm(true)
    // Scroll to form
    setTimeout(() => {
      document.getElementById('create-agent-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function handleOpenCreateForm() {
    setPrefilledPreset(null)
    setShowCreateForm(true)
  }

  function handleCloseCreateForm() {
    setShowCreateForm(false)
    setPrefilledPreset(null)
  }

  function handleAgentCreated(agent: Agent) {
    setAgents(prev => [agent, ...prev])
    setShowCreateForm(false)
    setPrefilledPreset(null)
  }

  function handleRunStarted(run: AgentRun) {
    // Bump trigger so any open run panels refresh
    setRunRefreshTrigger(v => v + 1)
    // Update agent status optimistically
    setAgents(prev =>
      prev.map(a => a.id === run.agentId ? { ...a, status: run.status } : a)
    )
    setRunTaskAgent(null)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Agent Command Center"
        subtitle="Deploy specialized AI agents"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* ── Toolbar ── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPresets(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all',
                  showPresets
                    ? 'border-cyan-400/25 bg-cyan-400/5 text-cyan-400'
                    : 'border-white/8 text-white/40 hover:text-white/60 hover:border-white/15'
                )}
              >
                {showPresets ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                Preset Agents
              </button>
              <span className="text-white/20 text-xs nexus-mono">{agents.length} deployed</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSwarm(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all',
                  showSwarm
                    ? 'border-violet-400/40 bg-violet-400/10 text-violet-400'
                    : 'border-violet-400/20 text-violet-400/60 hover:text-violet-400 hover:border-violet-400/35 hover:bg-violet-400/5'
                )}
              >
                <Layers size={13} />
                SWARM MODE
              </button>

              <button
                onClick={handleOpenCreateForm}
                className="nexus-btn-primary flex items-center gap-2 text-sm"
              >
                <Plus size={15} />
                Deploy Agent
              </button>
            </div>
          </div>

          {/* ── Swarm Mode Panel ── */}
          {showSwarm && (
            <SwarmModePanel onClose={() => setShowSwarm(false)} />
          )}

          {/* ── Preset Grid ── */}
          {showPresets && (
            <section>
              <p className="text-white/30 text-xs mb-3 flex items-center gap-1.5">
                <Zap size={11} className="text-cyan-400/50" />
                Quick-deploy a preset — click Deploy on any card to pre-fill the form
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {PRESET_AGENTS.map(preset => (
                  <PresetCard key={preset.name} preset={preset} onDeploy={handlePresetDeploy} />
                ))}
              </div>
            </section>
          )}

          {/* ── Create Form ── */}
          {showCreateForm && (
            <div id="create-agent-form">
              <CreateAgentForm
                initial={prefilledPreset ?? undefined}
                onClose={handleCloseCreateForm}
                onCreated={handleAgentCreated}
              />
            </div>
          )}

          {/* ── My Agents ── */}
          <section>
            <h2 className="text-white/60 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
              <Bot size={12} className="text-cyan-400/60" />
              My Agents
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-14">
                <div className="w-7 h-7 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              </div>
            ) : agents.length === 0 ? (
              <div className="glass-panel rounded-2xl py-14 text-center">
                <Bot size={40} className="text-white/15 mx-auto mb-3" />
                <p className="text-white/40 font-medium">No agents deployed yet</p>
                <p className="text-white/25 text-sm mt-1">Choose a preset above to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {agents.map(agent => (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    onDelete={deleteAgent}
                    onRunTask={setRunTaskAgent}
                    runRefreshTrigger={runRefreshTrigger}
                  />
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      {/* ── Run Task Modal ── */}
      {runTaskAgent && (
        <RunTaskModal
          agent={runTaskAgent}
          onClose={() => setRunTaskAgent(null)}
          onRunStarted={handleRunStarted}
        />
      )}
    </div>
  )
}
