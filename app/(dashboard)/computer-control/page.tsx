'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import {
  MousePointer2,
  Eye,
  CheckCircle,
  Zap,
  Bot,
  FlaskConical,
  Globe,
  Search,
  FileText,
  BookOpen,
  Clock,
  Check,
  X,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Shield,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type ExecutionMode = 'observation' | 'approval' | 'assisted' | 'autonomous' | 'sandbox'

type ActionType = 'open_url' | 'search_web' | 'analyze_text' | 'summarize_url'

interface PendingItem {
  actionId: string
  action: string
  description: string
  createdAt: string
}

interface LogEntry {
  id: string
  timestamp: string
  action: string
  mode: string
  result: string
  status: 'success' | 'pending' | 'rejected' | 'blocked'
}

// ─── Mode Config ──────────────────────────────────────────────────────────────

const MODES: {
  id: ExecutionMode
  icon: React.ElementType
  name: string
  description: string
  color: string
  border: string
  bg: string
}[] = [
  {
    id: 'observation',
    icon: Eye,
    name: 'Observation',
    description: 'Analyze only — never execute. Returns description of what would happen.',
    color: 'text-blue-400',
    border: 'border-blue-400/40',
    bg: 'bg-blue-400/5',
  },
  {
    id: 'approval',
    icon: CheckCircle,
    name: 'Approval',
    description: 'Propose actions, require your confirmation before any execution.',
    color: 'text-yellow-400',
    border: 'border-yellow-400/40',
    bg: 'bg-yellow-400/5',
  },
  {
    id: 'assisted',
    icon: Zap,
    name: 'Assisted',
    description: 'Auto-execute safe actions; request approval for sensitive operations.',
    color: 'text-cyan-400',
    border: 'border-cyan-400/40',
    bg: 'bg-cyan-400/5',
  },
  {
    id: 'autonomous',
    icon: Bot,
    name: 'Autonomous',
    description: 'Execute within safety boundaries — no file deletion or unconfirmed calls.',
    color: 'text-green-400',
    border: 'border-green-400/40',
    bg: 'bg-green-400/5',
  },
  {
    id: 'sandbox',
    icon: FlaskConical,
    name: 'Sandbox',
    description: 'Execute and log results without affecting real data. Safe for testing.',
    color: 'text-orange-400',
    border: 'border-orange-400/40',
    bg: 'bg-orange-400/5',
  },
]

// ─── Action Config ────────────────────────────────────────────────────────────

const QUICK_ACTIONS: {
  id: ActionType
  icon: React.ElementType
  label: string
  description: string
  inputs: { key: string; label: string; placeholder: string; type?: string }[]
}[] = [
  {
    id: 'open_url',
    icon: Globe,
    label: 'Fetch URL',
    description: 'Fetch and extract text content from any URL',
    inputs: [{ key: 'url', label: 'URL', placeholder: 'https://example.com' }],
  },
  {
    id: 'search_web',
    icon: Search,
    label: 'Web Search',
    description: 'Search the web via DuckDuckGo Instant Answers',
    inputs: [{ key: 'query', label: 'Search Query', placeholder: 'e.g. latest AI news' }],
  },
  {
    id: 'analyze_text',
    icon: FileText,
    label: 'Analyze Text',
    description: 'Use Claude Haiku to analyze any text',
    inputs: [
      { key: 'text', label: 'Text to Analyze', placeholder: 'Paste your text here...', type: 'textarea' },
      { key: 'instruction', label: 'Instruction (optional)', placeholder: 'e.g. Summarize key points' },
    ],
  },
  {
    id: 'summarize_url',
    icon: BookOpen,
    label: 'Summarize URL',
    description: 'Fetch a URL and generate an AI summary',
    inputs: [{ key: 'url', label: 'URL to Summarize', placeholder: 'https://example.com/article' }],
  },
]

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LogEntry['status'] }) {
  const config = {
    success: { color: 'text-green-400 bg-green-400/10 border-green-400/20', label: 'SUCCESS' },
    pending: { color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', label: 'PENDING' },
    rejected: { color: 'text-red-400 bg-red-400/10 border-red-400/20', label: 'REJECTED' },
    blocked: { color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', label: 'BLOCKED' },
  }
  const c = config[status]
  return (
    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${c.color}`}>
      {c.label}
    </span>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ComputerControlPage() {
  const [mode, setMode] = useState<ExecutionMode>('observation')
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null)
  const [inputValues, setInputValues] = useState<Record<string, string>>({})
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [resultRaw, setResultRaw] = useState<unknown>(null)
  const [isPending, setIsPending] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [executionLog, setExecutionLog] = useState<LogEntry[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  // ── Poll pending actions ──────────────────────────────────────────────────
  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/computer-control')
      if (res.ok) {
        const data = await res.json()
        setPendingItems(data.pending || [])
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchPending()
    const interval = setInterval(fetchPending, 5000)
    return () => clearInterval(interval)
  }, [fetchPending])

  // ── Select action ─────────────────────────────────────────────────────────
  function handleSelectAction(actionId: ActionType) {
    setSelectedAction(actionId)
    setInputValues({})
    setResult(null)
    setResultRaw(null)
    setIsPending(false)
    setPendingActionId(null)
  }

  // ── Execute ───────────────────────────────────────────────────────────────
  async function handleExecute() {
    if (!selectedAction || executing) return

    const actionConfig = QUICK_ACTIONS.find(a => a.id === selectedAction)
    if (!actionConfig) return

    // Validate required inputs
    for (const input of actionConfig.inputs) {
      if (input.key !== 'instruction' && !inputValues[input.key]?.trim()) {
        toast.error(`${input.label} is required`)
        return
      }
    }

    setExecuting(true)
    setResult(null)
    setResultRaw(null)
    setIsPending(false)
    setPendingActionId(null)

    try {
      const res = await fetch('/api/computer-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: selectedAction,
          params: inputValues,
          mode,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Execution failed')
        setResult(`Error: ${data.error || 'Unknown error'}`)
        addLog(selectedAction, mode, `Error: ${data.error}`, 'rejected')
        return
      }

      if (data.pending) {
        setIsPending(true)
        setPendingActionId(data.actionId)
        setResult(data.description)
        addLog(selectedAction, mode, data.description, 'pending')
        toast.success('Action queued — awaiting approval')
        await fetchPending()
      } else {
        setResultRaw(data.result)
        try {
          const parsed = JSON.parse(data.result)
          setResult(JSON.stringify(parsed, null, 2))
        } catch {
          setResult(String(data.result))
        }
        const status = data.blocked ? 'blocked' : 'success'
        addLog(selectedAction, mode, String(data.result).slice(0, 200), status)
        if (data.blocked) {
          toast('Action blocked by safety boundary', { icon: '🛡️' })
        } else {
          toast.success('Action executed successfully')
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      toast.error(msg)
      setResult(`Error: ${msg}`)
      addLog(selectedAction, mode, msg, 'rejected')
    } finally {
      setExecuting(false)
    }
  }

  function addLog(action: string, logMode: string, resultText: string, status: LogEntry['status']) {
    setExecutionLog(prev => [
      {
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
        action,
        mode: logMode,
        result: resultText,
        status,
      },
      ...prev.slice(0, 19),
    ])
  }

  // ── Approve pending ───────────────────────────────────────────────────────
  async function handleApprove(actionId: string) {
    setApprovingId(actionId)
    try {
      const res = await fetch(`/api/computer-control/approve/${actionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Approval failed')
        return
      }
      toast.success('Action approved and executed')
      addLog(data.action || 'action', 'approved', String(data.result || '').slice(0, 200), 'success')
      if (pendingActionId === actionId) {
        try {
          const parsed = JSON.parse(data.result)
          setResult(JSON.stringify(parsed, null, 2))
        } catch {
          setResult(String(data.result))
        }
        setIsPending(false)
        setPendingActionId(null)
      }
      await fetchPending()
    } catch {
      toast.error('Failed to approve action')
    } finally {
      setApprovingId(null)
    }
  }

  // ── Reject pending ────────────────────────────────────────────────────────
  async function handleReject(actionId: string) {
    setRejectingId(actionId)
    try {
      const res = await fetch(`/api/computer-control/approve/${actionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Rejection failed')
        return
      }
      toast('Action rejected', { icon: '🚫' })
      addLog('action', 'rejected', 'Action rejected by user', 'rejected')
      if (pendingActionId === actionId) {
        setIsPending(false)
        setPendingActionId(null)
        setResult('Action was rejected.')
      }
      await fetchPending()
    } catch {
      toast.error('Failed to reject action')
    } finally {
      setRejectingId(null)
    }
  }

  const selectedActionConfig = QUICK_ACTIONS.find(a => a.id === selectedAction)
  const selectedMode = MODES.find(m => m.id === mode)!

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="COMPUTER CONTROL" subtitle="Local device assistance & browser automation" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1400px] mx-auto space-y-4">

          {/* ── Safety Warning Banner ──────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-yellow-400/30 bg-yellow-400/5">
            <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-400/80">
              <span className="font-semibold text-yellow-400">NEXUS</span> never modifies your files or runs scripts without explicit approval. All actions are logged for your security.
            </p>
            <Shield size={14} className="text-yellow-400/50 flex-shrink-0 ml-auto" />
          </div>

          {/* ── Execution Mode Selector ────────────────────────────────────── */}
          <div className="hud-stat-card rounded-xl p-5">
            <div className="hud-label mb-3 flex items-center gap-2">
              <MousePointer2 size={13} className="text-cyan-400" />
              EXECUTION MODE
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {MODES.map(m => {
                const Icon = m.icon
                const isActive = mode === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`flex flex-col gap-2 p-3 rounded-xl border transition-all duration-200 text-left ${
                      isActive
                        ? `${m.border} ${m.bg}`
                        : 'border-white/8 bg-white/2 hover:bg-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={isActive ? m.color : 'text-white/40'} />
                      <span className={`text-xs font-semibold ${isActive ? m.color : 'text-white/50'}`}>
                        {m.name.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/35 leading-relaxed">{m.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Main Area: Quick Actions + Action Input ────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Quick Actions */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="hud-label mb-3">QUICK ACTIONS</div>
              <div className="space-y-2">
                {QUICK_ACTIONS.map(action => {
                  const Icon = action.icon
                  const isSelected = selectedAction === action.id
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleSelectAction(action.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 text-left group ${
                        isSelected
                          ? 'border-cyan-400/40 bg-cyan-400/8'
                          : 'border-white/8 bg-white/2 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <Icon
                        size={15}
                        className={isSelected ? 'text-cyan-400' : 'text-white/40 group-hover:text-white/60'}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isSelected ? 'text-cyan-400' : 'text-white/60'}`}>
                          {action.label}
                        </p>
                        <p className="text-[11px] text-white/30 truncate">{action.description}</p>
                      </div>
                      <ChevronRight
                        size={12}
                        className={`flex-shrink-0 transition-transform ${isSelected ? 'text-cyan-400 translate-x-0.5' : 'text-white/20'}`}
                      />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Action Input Panel */}
            <div className="lg:col-span-2 hud-stat-card rounded-xl p-5 flex flex-col gap-4">
              {!selectedAction ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <MousePointer2 size={28} className="text-white/15" />
                  <p className="text-sm text-white/30 text-center">Select a quick action to get started</p>
                </div>
              ) : (
                <>
                  {/* Action header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedActionConfig && (
                        <selectedActionConfig.icon size={15} className="text-cyan-400" />
                      )}
                      <span className="text-sm font-semibold text-white/80">
                        {selectedActionConfig?.label}
                      </span>
                    </div>
                    {/* Mode badge */}
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border ${selectedMode.color} ${selectedMode.border} ${selectedMode.bg}`}
                    >
                      {mode.toUpperCase()}
                    </span>
                  </div>

                  {/* Inputs */}
                  <div className="space-y-3">
                    {selectedActionConfig?.inputs.map(input => (
                      <div key={input.key}>
                        <label className="hud-label block mb-1.5">{input.label}</label>
                        {input.type === 'textarea' ? (
                          <textarea
                            value={inputValues[input.key] || ''}
                            onChange={e => setInputValues(prev => ({ ...prev, [input.key]: e.target.value }))}
                            placeholder={input.placeholder}
                            rows={4}
                            className="w-full bg-white/3 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors resize-none nexus-mono"
                          />
                        ) : (
                          <input
                            type="text"
                            value={inputValues[input.key] || ''}
                            onChange={e => setInputValues(prev => ({ ...prev, [input.key]: e.target.value }))}
                            placeholder={input.placeholder}
                            onKeyDown={e => e.key === 'Enter' && !executing && handleExecute()}
                            className="w-full bg-white/3 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors nexus-mono"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Execute button */}
                  <button
                    onClick={handleExecute}
                    disabled={executing}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-sm font-semibold hover:bg-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {executing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        EXECUTING...
                      </>
                    ) : (
                      <>
                        <Zap size={14} />
                        EXECUTE
                      </>
                    )}
                  </button>

                  {/* Result panel */}
                  {(result !== null || isPending) && (
                    <div className="rounded-lg border border-white/8 bg-white/2 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                        <span className="hud-label">RESULT</span>
                        {isPending ? (
                          <span className="text-[10px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded px-1.5 py-0.5">
                            AWAITING APPROVAL
                          </span>
                        ) : (
                          <span className="text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 rounded px-1.5 py-0.5">
                            COMPLETE
                          </span>
                        )}
                      </div>
                      <div className="p-3 max-h-64 overflow-y-auto">
                        <pre className="text-xs text-white/60 whitespace-pre-wrap nexus-mono leading-relaxed">
                          {result}
                        </pre>
                      </div>
                      {isPending && pendingActionId && (
                        <div className="flex gap-2 px-3 pb-3">
                          <button
                            onClick={() => handleApprove(pendingActionId)}
                            disabled={!!approvingId}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-all disabled:opacity-50"
                          >
                            {approvingId === pendingActionId ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            APPROVE
                          </button>
                          <button
                            onClick={() => handleReject(pendingActionId)}
                            disabled={!!rejectingId}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all disabled:opacity-50"
                          >
                            {rejectingId === pendingActionId ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                            REJECT
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Bottom Row: Pending Approvals + Execution Log ─────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Pending Approvals */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="hud-label flex items-center gap-2">
                  <Clock size={13} className="text-yellow-400" />
                  PENDING APPROVALS
                </div>
                {pendingItems.length > 0 && (
                  <span className="text-[10px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-2 py-0.5">
                    {pendingItems.length}
                  </span>
                )}
              </div>

              {pendingItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Check size={20} className="text-white/15" />
                  <p className="text-sm text-white/30">No pending approvals</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {pendingItems.map(item => (
                    <div
                      key={item.actionId}
                      className="p-3 rounded-lg border border-yellow-400/15 bg-yellow-400/3"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-mono font-semibold text-yellow-400">
                            {item.action.toUpperCase()}
                          </span>
                          <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                        <span className="text-[10px] text-white/25 flex-shrink-0">
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(item.actionId)}
                          disabled={approvingId === item.actionId}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-medium hover:bg-green-500/20 transition-all disabled:opacity-50"
                        >
                          {approvingId === item.actionId ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                          APPROVE
                        </button>
                        <button
                          onClick={() => handleReject(item.actionId)}
                          disabled={rejectingId === item.actionId}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-all disabled:opacity-50"
                        >
                          {rejectingId === item.actionId ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                          REJECT
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Execution Log */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="hud-label mb-3 flex items-center gap-2">
                <Zap size={13} className="text-violet-400" />
                EXECUTION LOG
                <span className="text-white/25 font-normal">last {Math.min(executionLog.length, 20)}</span>
              </div>

              {executionLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Zap size={20} className="text-white/15" />
                  <p className="text-sm text-white/30">No executions yet</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {executionLog.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/2 border border-white/5 hover:bg-white/4 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-xs font-mono font-semibold text-white/60">
                            {entry.action.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-white/25 border border-white/10 rounded px-1 py-0.5">
                            {entry.mode}
                          </span>
                          <StatusBadge status={entry.status} />
                        </div>
                        <p className="text-[11px] text-white/35 truncate nexus-mono">
                          {entry.result.slice(0, 120)}
                        </p>
                      </div>
                      <span className="text-[10px] text-white/20 flex-shrink-0 nexus-mono">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
