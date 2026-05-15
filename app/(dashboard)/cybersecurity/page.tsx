'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import {
  Shield,
  AlertTriangle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Edit3,
  X,
  Check,
  FileText,
  Download,
  Loader2,
  Eye,
  Lock,
  ShieldAlert,
  BookOpen,
  Cpu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskEntry {
  id: string
  title: string
  description?: string
  category: string
  likelihood: string
  impact: string
  riskScore: number
  status: string
  owner?: string
  mitigation?: string
  framework?: string
  controlRef?: string
  dueDate?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

interface ThreatModel {
  id: string
  title: string
  description?: string
  system?: string
  methodology: string
  threats?: string
  mitigations?: string
  status: string
  createdAt: string
  updatedAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['Risk Register', 'Threat Models', 'Frameworks', 'AI Analysis'] as const
type Tab = typeof TABS[number]

const FRAMEWORKS = ['All', 'ISO27001', 'SOC2', 'NIST', 'AI_Gov', 'Custom'] as const
const STATUSES = ['All', 'open', 'mitigated', 'accepted', 'closed'] as const
const CATEGORIES = ['Technical', 'People', 'Process', 'External', 'Physical'] as const
const LEVELS = ['Critical', 'High', 'Medium', 'Low'] as const
const METHODOLOGIES = ['STRIDE', 'DREAD', 'PASTA', 'Custom'] as const
const ANALYSIS_TYPES = [
  'Gap Analysis',
  'Control Review',
  'Risk Identification',
  'Compliance Check',
  'Threat Analysis',
] as const

const STRIDE_CATEGORIES = [
  { letter: 'S', name: 'Spoofing', desc: 'Identity spoofing, credential theft, impersonation' },
  { letter: 'T', name: 'Tampering', desc: 'Data modification, integrity violations, injection' },
  { letter: 'R', name: 'Repudiation', desc: 'Denial of actions, audit log manipulation' },
  { letter: 'I', name: 'Information Disclosure', desc: 'Data leakage, unauthorized data access' },
  { letter: 'D', name: 'Denial of Service', desc: 'Availability attacks, resource exhaustion' },
  { letter: 'E', name: 'Elevation of Privilege', desc: 'Privilege escalation, authorization bypass' },
]

function getRiskColor(score: number) {
  if (score >= 12) return 'text-red-400'
  if (score >= 8) return 'text-orange-400'
  if (score >= 4) return 'text-yellow-400'
  return 'text-green-400'
}

function getRiskBg(score: number) {
  if (score >= 12) return 'bg-red-400/15 border-red-400/30'
  if (score >= 8) return 'bg-orange-400/15 border-orange-400/30'
  if (score >= 4) return 'bg-yellow-400/15 border-yellow-400/30'
  return 'bg-green-400/15 border-green-400/30'
}

function getRiskLabel(score: number) {
  if (score >= 12) return 'CRITICAL'
  if (score >= 8) return 'HIGH'
  if (score >= 4) return 'MEDIUM'
  return 'LOW'
}

function getStatusColor(status: string) {
  switch (status) {
    case 'open': return 'text-red-400 bg-red-400/10'
    case 'mitigated': return 'text-green-400 bg-green-400/10'
    case 'accepted': return 'text-yellow-400 bg-yellow-400/10'
    case 'closed': return 'text-white/40 bg-white/5'
    default: return 'text-white/40 bg-white/5'
  }
}

function formatFramework(f?: string) {
  if (!f) return '—'
  if (f === 'AI_Gov') return 'AI Gov'
  return f
}

// ─── Empty form states ─────────────────────────────────────────────────────

const emptyRisk = {
  title: '',
  description: '',
  category: 'Technical' as string,
  likelihood: 'Medium' as string,
  impact: 'Medium' as string,
  status: 'open' as string,
  owner: '',
  mitigation: '',
  framework: '' as string,
  controlRef: '',
  dueDate: '',
  notes: '',
}

const emptyThreat = {
  title: '',
  description: '',
  system: '',
  methodology: 'STRIDE' as string,
  threats: '',
  mitigations: '',
  status: 'draft' as string,
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CybersecurityPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Risk Register')

  // Risk state
  const [risks, setRisks] = useState<RiskEntry[]>([])
  const [risksLoading, setRisksLoading] = useState(true)
  const [frameworkFilter, setFrameworkFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showRiskForm, setShowRiskForm] = useState(false)
  const [riskForm, setRiskForm] = useState({ ...emptyRisk })
  const [submittingRisk, setSubmittingRisk] = useState(false)
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null)
  const [editingRisk, setEditingRisk] = useState<string | null>(null)
  const [editRiskForm, setEditRiskForm] = useState({ ...emptyRisk })
  const [deletingRisk, setDeletingRisk] = useState<string | null>(null)

  // Threat model state
  const [threats, setThreats] = useState<ThreatModel[]>([])
  const [threatsLoading, setThreatsLoading] = useState(true)
  const [showThreatForm, setShowThreatForm] = useState(false)
  const [threatForm, setThreatForm] = useState({ ...emptyThreat })
  const [submittingThreat, setSubmittingThreat] = useState(false)
  const [strideEntries, setStrideEntries] = useState<Record<string, string>>({})
  const [deletingThreat, setDeletingThreat] = useState<string | null>(null)
  const [expandedThreat, setExpandedThreat] = useState<string | null>(null)

  // AI Analysis state
  const [analysisText, setAnalysisText] = useState('')
  const [analysisType, setAnalysisType] = useState<string>('Gap Analysis')
  const [analysisFramework, setAnalysisFramework] = useState('ISO 27001')
  const [analysisResult, setAnalysisResult] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // ── Load risks ──────────────────────────────────────────────────────────────

  const loadRisks = useCallback(async () => {
    setRisksLoading(true)
    try {
      const params = new URLSearchParams()
      if (frameworkFilter !== 'All') params.set('framework', frameworkFilter)
      if (statusFilter !== 'All') params.set('status', statusFilter)
      params.set('sort', 'score')
      const res = await fetch(`/api/cybersecurity/risks?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRisks(data.risks || [])
    } catch {
      toast.error('Failed to load risks')
    } finally {
      setRisksLoading(false)
    }
  }, [frameworkFilter, statusFilter])

  useEffect(() => {
    loadRisks()
  }, [loadRisks])

  // ── Load threats ────────────────────────────────────────────────────────────

  const loadThreats = useCallback(async () => {
    setThreatsLoading(true)
    try {
      const res = await fetch('/api/cybersecurity/threats')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setThreats(data.threats || [])
    } catch {
      toast.error('Failed to load threat models')
    } finally {
      setThreatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadThreats()
  }, [loadThreats])

  // ── Risk CRUD ───────────────────────────────────────────────────────────────

  async function createRisk() {
    if (!riskForm.title.trim()) {
      toast.error('Title is required')
      return
    }
    setSubmittingRisk(true)
    try {
      const body: Record<string, string> = {
        title: riskForm.title,
        description: riskForm.description,
        category: riskForm.category,
        likelihood: riskForm.likelihood,
        impact: riskForm.impact,
        status: riskForm.status,
        owner: riskForm.owner,
        mitigation: riskForm.mitigation,
        controlRef: riskForm.controlRef,
        notes: riskForm.notes,
      }
      if (riskForm.framework) body.framework = riskForm.framework
      if (riskForm.dueDate) body.dueDate = riskForm.dueDate

      const res = await fetch('/api/cybersecurity/risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Risk added')
      setRiskForm({ ...emptyRisk })
      setShowRiskForm(false)
      loadRisks()
    } catch {
      toast.error('Failed to create risk')
    } finally {
      setSubmittingRisk(false)
    }
  }

  async function saveEditRisk(id: string) {
    setSubmittingRisk(true)
    try {
      const body: Record<string, string | null> = {
        title: editRiskForm.title,
        description: editRiskForm.description,
        category: editRiskForm.category,
        likelihood: editRiskForm.likelihood,
        impact: editRiskForm.impact,
        status: editRiskForm.status,
        owner: editRiskForm.owner,
        mitigation: editRiskForm.mitigation,
        controlRef: editRiskForm.controlRef,
        notes: editRiskForm.notes,
        dueDate: editRiskForm.dueDate || null,
      }
      if (editRiskForm.framework) body.framework = editRiskForm.framework

      const res = await fetch(`/api/cybersecurity/risks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Risk updated')
      setEditingRisk(null)
      loadRisks()
    } catch {
      toast.error('Failed to update risk')
    } finally {
      setSubmittingRisk(false)
    }
  }

  async function deleteRisk(id: string) {
    setDeletingRisk(id)
    try {
      const res = await fetch(`/api/cybersecurity/risks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Risk deleted')
      setExpandedRisk(null)
      loadRisks()
    } catch {
      toast.error('Failed to delete risk')
    } finally {
      setDeletingRisk(null)
    }
  }

  // ── Threat CRUD ─────────────────────────────────────────────────────────────

  function buildThreatsJson() {
    if (threatForm.methodology === 'STRIDE') {
      const strideData: Record<string, string> = {}
      STRIDE_CATEGORIES.forEach(c => {
        if (strideEntries[c.letter]) strideData[c.letter] = strideEntries[c.letter]
      })
      return JSON.stringify(strideData)
    }
    return threatForm.threats
  }

  async function createThreat() {
    if (!threatForm.title.trim()) {
      toast.error('Title is required')
      return
    }
    setSubmittingThreat(true)
    try {
      const res = await fetch('/api/cybersecurity/threats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: threatForm.title,
          description: threatForm.description,
          system: threatForm.system,
          methodology: threatForm.methodology,
          threats: buildThreatsJson(),
          mitigations: threatForm.mitigations,
          status: threatForm.status,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Threat model created')
      setThreatForm({ ...emptyThreat })
      setStrideEntries({})
      setShowThreatForm(false)
      loadThreats()
    } catch {
      toast.error('Failed to create threat model')
    } finally {
      setSubmittingThreat(false)
    }
  }

  async function deleteThreat(id: string) {
    setDeletingThreat(id)
    try {
      const res = await fetch(`/api/cybersecurity/threats?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Threat model deleted')
      setExpandedThreat(null)
      loadThreats()
    } catch {
      toast.error('Failed to delete threat model')
    } finally {
      setDeletingThreat(null)
    }
  }

  // ── AI Analysis ─────────────────────────────────────────────────────────────

  async function runAnalysis() {
    if (!analysisText.trim()) {
      toast.error('Paste security content to analyze')
      return
    }
    setAnalysisLoading(true)
    setAnalysisResult('')
    try {
      const prompt = `You are a cybersecurity expert. Perform a ${analysisType} against the ${analysisFramework} framework on the following security documentation:\n\n${analysisText}\n\nProvide a structured analysis with findings, gaps, recommendations, and a risk rating. Format with clear sections.`
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          conversationId: null,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const content = data.message?.content || data.content || data.response || ''
      setAnalysisResult(typeof content === 'string' ? content : JSON.stringify(content, null, 2))
    } catch {
      toast.error('Analysis failed')
    } finally {
      setAnalysisLoading(false)
    }
  }

  function exportReport() {
    if (!analysisResult) return
    const blob = new Blob(
      [`NEXUS CYBERSECURITY ANALYSIS REPORT\n${'='.repeat(40)}\nType: ${analysisType}\nFramework: ${analysisFramework}\nDate: ${new Date().toISOString()}\n\n${analysisResult}`],
      { type: 'text/plain' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `security-analysis-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Derived stats ───────────────────────────────────────────────────────────

  const totalRisks = risks.length
  const criticalCount = risks.filter(r => r.riskScore >= 12).length
  const highCount = risks.filter(r => r.riskScore >= 8 && r.riskScore < 12).length
  const openCount = risks.filter(r => r.status === 'open').length

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="CYBERSECURITY" subtitle="Risk, Compliance & Security Operations" />

      <div className="p-6 space-y-6">

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-cyan-400/10">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px',
                activeTab === tab
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-white/40 hover:text-white/70'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ══ Tab 1: Risk Register ══════════════════════════════════════════════ */}
        {activeTab === 'Risk Register' && (
          <div className="space-y-5">

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Risks', value: totalRisks, color: 'text-cyan-400' },
                { label: 'Critical', value: criticalCount, color: 'text-red-400' },
                { label: 'High', value: highCount, color: 'text-orange-400' },
                { label: 'Open', value: openCount, color: 'text-yellow-400' },
              ].map(stat => (
                <div key={stat.label} className="hud-stat-card rounded-xl p-5">
                  <p className="hud-label text-[10px] tracking-widest mb-1">{stat.label}</p>
                  <p className={cn('text-3xl font-bold', stat.color)}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Filters + Add Risk button */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-white/40 text-xs nexus-mono mr-1">FRAMEWORK:</span>
                {FRAMEWORKS.map(f => (
                  <button
                    key={f}
                    onClick={() => setFrameworkFilter(f)}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs transition-all',
                      frameworkFilter === f
                        ? 'bg-cyan-400/15 text-cyan-400 border border-cyan-400/30'
                        : 'text-white/40 hover:text-white/70 border border-transparent'
                    )}
                  >
                    {f === 'AI_Gov' ? 'AI Gov' : f}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 flex-wrap ml-auto">
                <span className="text-white/40 text-xs nexus-mono mr-1">STATUS:</span>
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs capitalize transition-all',
                      statusFilter === s
                        ? 'bg-cyan-400/15 text-cyan-400 border border-cyan-400/30'
                        : 'text-white/40 hover:text-white/70 border border-transparent'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowRiskForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 hover:bg-cyan-400/20 text-sm transition-all"
              >
                <Plus size={14} />
                Add Risk
              </button>
            </div>

            {/* Add Risk inline form */}
            {showRiskForm && (
              <div className="hud-stat-card rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 text-sm font-semibold nexus-mono tracking-wider">NEW RISK ENTRY</span>
                  <button onClick={() => setShowRiskForm(false)} className="text-white/30 hover:text-white/60">
                    <X size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40 col-span-2"
                    placeholder="Risk title *"
                    value={riskForm.title}
                    onChange={e => setRiskForm(f => ({ ...f, title: e.target.value }))}
                  />
                  <textarea
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40 col-span-2 resize-none"
                    placeholder="Description"
                    rows={2}
                    value={riskForm.description}
                    onChange={e => setRiskForm(f => ({ ...f, description: e.target.value }))}
                  />
                  <div>
                    <label className="text-white/40 text-xs block mb-1">Category</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                      value={riskForm.category}
                      onChange={e => setRiskForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/40 text-xs block mb-1">Framework</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                      value={riskForm.framework}
                      onChange={e => setRiskForm(f => ({ ...f, framework: e.target.value }))}
                    >
                      <option value="">None</option>
                      {['ISO27001', 'SOC2', 'NIST', 'AI_Gov', 'Custom'].map(fw => (
                        <option key={fw} value={fw}>{fw === 'AI_Gov' ? 'AI Gov' : fw}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/40 text-xs block mb-1">Likelihood</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                      value={riskForm.likelihood}
                      onChange={e => setRiskForm(f => ({ ...f, likelihood: e.target.value }))}
                    >
                      {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/40 text-xs block mb-1">Impact</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                      value={riskForm.impact}
                      onChange={e => setRiskForm(f => ({ ...f, impact: e.target.value }))}
                    >
                      {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/40 text-xs block mb-1">Status</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                      value={riskForm.status}
                      onChange={e => setRiskForm(f => ({ ...f, status: e.target.value }))}
                    >
                      {['open', 'mitigated', 'accepted', 'closed'].map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/40 text-xs block mb-1">Owner</label>
                    <input
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40"
                      placeholder="Risk owner"
                      value={riskForm.owner}
                      onChange={e => setRiskForm(f => ({ ...f, owner: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-white/40 text-xs block mb-1">Control Reference</label>
                    <input
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40"
                      placeholder="e.g. A.9.2.1"
                      value={riskForm.controlRef}
                      onChange={e => setRiskForm(f => ({ ...f, controlRef: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-white/40 text-xs block mb-1">Due Date</label>
                    <input
                      type="date"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                      value={riskForm.dueDate}
                      onChange={e => setRiskForm(f => ({ ...f, dueDate: e.target.value }))}
                    />
                  </div>
                  <textarea
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40 col-span-2 resize-none"
                    placeholder="Mitigation plan"
                    rows={2}
                    value={riskForm.mitigation}
                    onChange={e => setRiskForm(f => ({ ...f, mitigation: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setShowRiskForm(false); setRiskForm({ ...emptyRisk }) }}
                    className="px-3 py-1.5 rounded-lg text-sm text-white/40 hover:text-white/60 border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createRisk}
                    disabled={submittingRisk}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/25 disabled:opacity-50 transition-all"
                  >
                    {submittingRisk ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Save Risk
                  </button>
                </div>
              </div>
            )}

            {/* Risk table */}
            {risksLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-cyan-400/50" />
              </div>
            ) : risks.length === 0 ? (
              <div className="text-center py-16 text-white/30">
                <Shield size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No risks found. Add your first risk entry.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Table header */}
                <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_80px_1fr_1fr_80px] gap-3 px-4 py-2 text-[10px] text-white/30 nexus-mono tracking-widest">
                  <span>TITLE</span>
                  <span>CATEGORY</span>
                  <span>LIKELIHOOD</span>
                  <span>IMPACT</span>
                  <span>SCORE</span>
                  <span>STATUS</span>
                  <span>OWNER</span>
                  <span>ACTIONS</span>
                </div>

                {risks.map(risk => (
                  <div key={risk.id} className="hud-stat-card rounded-xl overflow-hidden">
                    {/* Row */}
                    <div
                      className="grid grid-cols-[1fr_80px] md:grid-cols-[2fr_1fr_1fr_1fr_80px_1fr_1fr_80px] gap-3 px-4 py-3 items-center cursor-pointer"
                      onClick={() => setExpandedRisk(expandedRisk === risk.id ? null : risk.id)}
                    >
                      <span className="text-sm text-white font-medium truncate">{risk.title}</span>
                      <span className="hidden md:block text-xs text-white/50">{risk.category}</span>
                      <span className="hidden md:block text-xs text-white/50">{risk.likelihood}</span>
                      <span className="hidden md:block text-xs text-white/50">{risk.impact}</span>
                      <span className={cn('hidden md:flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold border', getRiskBg(risk.riskScore), getRiskColor(risk.riskScore))}>
                        {risk.riskScore}
                      </span>
                      <span className={cn('hidden md:inline-flex items-center px-2 py-0.5 rounded text-xs capitalize', getStatusColor(risk.status))}>
                        {risk.status}
                      </span>
                      <span className="hidden md:block text-xs text-white/40 truncate">{risk.owner || '—'}</span>
                      <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingRisk(risk.id)
                            setEditRiskForm({
                              title: risk.title,
                              description: risk.description || '',
                              category: risk.category,
                              likelihood: risk.likelihood,
                              impact: risk.impact,
                              status: risk.status,
                              owner: risk.owner || '',
                              mitigation: risk.mitigation || '',
                              framework: risk.framework || '',
                              controlRef: risk.controlRef || '',
                              dueDate: risk.dueDate ? risk.dueDate.split('T')[0] : '',
                              notes: risk.notes || '',
                            })
                            setExpandedRisk(risk.id)
                          }}
                          className="p-1.5 rounded text-white/30 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => deleteRisk(risk.id)}
                          disabled={deletingRisk === risk.id}
                          className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40"
                        >
                          {deletingRisk === risk.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                        {expandedRisk === risk.id ? <ChevronUp size={13} className="text-white/30" /> : <ChevronDown size={13} className="text-white/30" />}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {expandedRisk === risk.id && (
                      <div className="border-t border-white/5 px-4 py-4">
                        {editingRisk === risk.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40 col-span-2"
                                placeholder="Risk title"
                                value={editRiskForm.title}
                                onChange={e => setEditRiskForm(f => ({ ...f, title: e.target.value }))}
                              />
                              <textarea
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40 col-span-2 resize-none"
                                placeholder="Description"
                                rows={2}
                                value={editRiskForm.description}
                                onChange={e => setEditRiskForm(f => ({ ...f, description: e.target.value }))}
                              />
                              {[
                                { label: 'Category', key: 'category', options: CATEGORIES },
                                { label: 'Likelihood', key: 'likelihood', options: LEVELS },
                                { label: 'Impact', key: 'impact', options: LEVELS },
                                { label: 'Status', key: 'status', options: ['open', 'mitigated', 'accepted', 'closed'] },
                              ].map(({ label, key, options }) => (
                                <div key={key}>
                                  <label className="text-white/40 text-xs block mb-1">{label}</label>
                                  <select
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                                    value={(editRiskForm as Record<string, string>)[key]}
                                    onChange={e => setEditRiskForm(f => ({ ...f, [key]: e.target.value }))}
                                  >
                                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                </div>
                              ))}
                              <div>
                                <label className="text-white/40 text-xs block mb-1">Owner</label>
                                <input
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40"
                                  placeholder="Risk owner"
                                  value={editRiskForm.owner}
                                  onChange={e => setEditRiskForm(f => ({ ...f, owner: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="text-white/40 text-xs block mb-1">Control Ref</label>
                                <input
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40"
                                  placeholder="e.g. A.9.2.1"
                                  value={editRiskForm.controlRef}
                                  onChange={e => setEditRiskForm(f => ({ ...f, controlRef: e.target.value }))}
                                />
                              </div>
                              <textarea
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40 col-span-2 resize-none"
                                placeholder="Mitigation plan"
                                rows={2}
                                value={editRiskForm.mitigation}
                                onChange={e => setEditRiskForm(f => ({ ...f, mitigation: e.target.value }))}
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setEditingRisk(null)}
                                className="px-3 py-1.5 rounded-lg text-sm text-white/40 hover:text-white/60 border border-white/10"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveEditRisk(risk.id)}
                                disabled={submittingRisk}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/25 disabled:opacity-50"
                              >
                                {submittingRisk ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-white/30 text-xs mb-0.5">Score</p>
                              <p className={cn('font-bold text-lg', getRiskColor(risk.riskScore))}>
                                {risk.riskScore} — {getRiskLabel(risk.riskScore)}
                              </p>
                            </div>
                            {risk.framework && (
                              <div>
                                <p className="text-white/30 text-xs mb-0.5">Framework</p>
                                <p className="text-white/70">{formatFramework(risk.framework)}</p>
                              </div>
                            )}
                            {risk.controlRef && (
                              <div>
                                <p className="text-white/30 text-xs mb-0.5">Control Ref</p>
                                <p className="text-white/70">{risk.controlRef}</p>
                              </div>
                            )}
                            {risk.description && (
                              <div className="col-span-2 md:col-span-3">
                                <p className="text-white/30 text-xs mb-0.5">Description</p>
                                <p className="text-white/70">{risk.description}</p>
                              </div>
                            )}
                            {risk.mitigation && (
                              <div className="col-span-2 md:col-span-3">
                                <p className="text-white/30 text-xs mb-0.5">Mitigation Plan</p>
                                <p className="text-white/70">{risk.mitigation}</p>
                              </div>
                            )}
                            {risk.dueDate && (
                              <div>
                                <p className="text-white/30 text-xs mb-0.5">Due Date</p>
                                <p className="text-white/70">{new Date(risk.dueDate).toLocaleDateString()}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ Tab 2: Threat Models ══════════════════════════════════════════════ */}
        {activeTab === 'Threat Models' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Threat Models</h2>
                <p className="text-white/40 text-xs mt-0.5">STRIDE, DREAD, PASTA methodologies</p>
              </div>
              <button
                onClick={() => setShowThreatForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 hover:bg-cyan-400/20 text-sm transition-all"
              >
                <Plus size={14} />
                Add Threat Model
              </button>
            </div>

            {/* Add form */}
            {showThreatForm && (
              <div className="hud-stat-card rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 text-sm font-semibold nexus-mono tracking-wider">NEW THREAT MODEL</span>
                  <button onClick={() => { setShowThreatForm(false); setThreatForm({ ...emptyThreat }); setStrideEntries({}) }} className="text-white/30 hover:text-white/60">
                    <X size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40 col-span-2"
                    placeholder="Title *"
                    value={threatForm.title}
                    onChange={e => setThreatForm(f => ({ ...f, title: e.target.value }))}
                  />
                  <input
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40 col-span-2"
                    placeholder="System being modeled (e.g. Payment API)"
                    value={threatForm.system}
                    onChange={e => setThreatForm(f => ({ ...f, system: e.target.value }))}
                  />
                  <div>
                    <label className="text-white/40 text-xs block mb-1">Methodology</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                      value={threatForm.methodology}
                      onChange={e => setThreatForm(f => ({ ...f, methodology: e.target.value }))}
                    >
                      {METHODOLOGIES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/40 text-xs block mb-1">Status</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                      value={threatForm.status}
                      onChange={e => setThreatForm(f => ({ ...f, status: e.target.value }))}
                    >
                      {['draft', 'in_review', 'approved', 'archived'].map(s => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* STRIDE helper */}
                {threatForm.methodology === 'STRIDE' && (
                  <div className="space-y-2">
                    <p className="text-white/40 text-xs nexus-mono tracking-wider">STRIDE CATEGORIES</p>
                    {STRIDE_CATEGORIES.map(cat => (
                      <div key={cat.letter} className="flex gap-3 items-start">
                        <div className="flex-shrink-0 w-6 h-6 rounded bg-cyan-400/15 border border-cyan-400/25 flex items-center justify-center">
                          <span className="text-cyan-400 text-xs font-bold">{cat.letter}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-white/70 mb-1">
                            <span className="text-cyan-400">{cat.name}</span>
                            <span className="text-white/30 ml-2 text-[10px]">{cat.desc}</span>
                          </p>
                          <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-cyan-400/30 resize-none"
                            placeholder={`Describe ${cat.name.toLowerCase()} threats...`}
                            rows={2}
                            value={strideEntries[cat.letter] || ''}
                            onChange={e => setStrideEntries(prev => ({ ...prev, [cat.letter]: e.target.value }))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Non-STRIDE threat text */}
                {threatForm.methodology !== 'STRIDE' && (
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40 resize-none"
                    placeholder="Describe identified threats..."
                    rows={4}
                    value={threatForm.threats}
                    onChange={e => setThreatForm(f => ({ ...f, threats: e.target.value }))}
                  />
                )}

                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/40 resize-none"
                  placeholder="Mitigations and controls..."
                  rows={3}
                  value={threatForm.mitigations}
                  onChange={e => setThreatForm(f => ({ ...f, mitigations: e.target.value }))}
                />

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setShowThreatForm(false); setThreatForm({ ...emptyThreat }); setStrideEntries({}) }}
                    className="px-3 py-1.5 rounded-lg text-sm text-white/40 hover:text-white/60 border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createThreat}
                    disabled={submittingThreat}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/25 disabled:opacity-50 transition-all"
                  >
                    {submittingThreat ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Threat models list */}
            {threatsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-cyan-400/50" />
              </div>
            ) : threats.length === 0 ? (
              <div className="text-center py-16 text-white/30">
                <ShieldAlert size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No threat models yet. Create your first one.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {threats.map(threat => {
                  let parsedThreats: Record<string, string> | null = null
                  if (threat.methodology === 'STRIDE' && threat.threats) {
                    try { parsedThreats = JSON.parse(threat.threats) } catch { /* noop */ }
                  }
                  return (
                    <div key={threat.id} className="hud-stat-card rounded-xl overflow-hidden">
                      <div
                        className="flex items-center gap-4 px-4 py-3 cursor-pointer"
                        onClick={() => setExpandedThreat(expandedThreat === threat.id ? null : threat.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white truncate">{threat.title}</span>
                            <span className="text-[10px] nexus-mono px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
                              {threat.methodology}
                            </span>
                            <span className={cn('text-[10px] capitalize px-1.5 py-0.5 rounded', getStatusColor(threat.status))}>
                              {threat.status.replace('_', ' ')}
                            </span>
                          </div>
                          {threat.system && (
                            <p className="text-white/40 text-xs mt-0.5">System: {threat.system}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => deleteThreat(threat.id)}
                            disabled={deletingThreat === threat.id}
                            className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40"
                          >
                            {deletingThreat === threat.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                          {expandedThreat === threat.id ? <ChevronUp size={13} className="text-white/30" /> : <ChevronDown size={13} className="text-white/30" />}
                        </div>
                      </div>

                      {expandedThreat === threat.id && (
                        <div className="border-t border-white/5 px-4 py-4 space-y-3">
                          {threat.description && (
                            <div>
                              <p className="text-white/30 text-xs mb-1">Description</p>
                              <p className="text-white/70 text-sm">{threat.description}</p>
                            </div>
                          )}
                          {threat.methodology === 'STRIDE' && parsedThreats ? (
                            <div>
                              <p className="text-white/30 text-xs mb-2 nexus-mono">STRIDE ANALYSIS</p>
                              <div className="space-y-2">
                                {STRIDE_CATEGORIES.map(cat => parsedThreats![cat.letter] ? (
                                  <div key={cat.letter} className="flex gap-3">
                                    <div className="flex-shrink-0 w-5 h-5 rounded bg-cyan-400/15 border border-cyan-400/25 flex items-center justify-center">
                                      <span className="text-cyan-400 text-[10px] font-bold">{cat.letter}</span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-cyan-400 font-medium">{cat.name}: </span>
                                      <span className="text-xs text-white/60">{parsedThreats![cat.letter]}</span>
                                    </div>
                                  </div>
                                ) : null)}
                              </div>
                            </div>
                          ) : threat.threats ? (
                            <div>
                              <p className="text-white/30 text-xs mb-1">Threats</p>
                              <p className="text-white/70 text-sm">{threat.threats}</p>
                            </div>
                          ) : null}
                          {threat.mitigations && (
                            <div>
                              <p className="text-white/30 text-xs mb-1">Mitigations</p>
                              <p className="text-white/70 text-sm">{threat.mitigations}</p>
                            </div>
                          )}
                          <p className="text-white/20 text-xs">
                            Created {new Date(threat.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ Tab 3: Frameworks ════════════════════════════════════════════════ */}
        {activeTab === 'Frameworks' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white font-semibold">Compliance Frameworks</h2>
              <p className="text-white/40 text-xs mt-0.5">Reference cards for supported security frameworks</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* ISO 27001 */}
              <div className="hud-stat-card rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
                    <Lock size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">ISO 27001</h3>
                    <p className="text-white/40 text-xs">Information Security Management System</p>
                  </div>
                  <span className="ml-auto text-[10px] nexus-mono px-2 py-1 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">93 Controls</span>
                </div>
                <p className="text-white/50 text-xs leading-relaxed">
                  International standard for establishing, implementing, maintaining and continually improving an ISMS. Annex A provides 93 controls across 4 domains.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { code: 'A.5', name: 'Organisational Controls', count: 37 },
                    { code: 'A.6', name: 'People Controls', count: 8 },
                    { code: 'A.7', name: 'Physical Controls', count: 14 },
                    { code: 'A.8', name: 'Technological Controls', count: 34 },
                  ].map(domain => (
                    <div key={domain.code} className="bg-white/3 rounded-lg p-2.5">
                      <p className="text-blue-400 text-[10px] nexus-mono">{domain.code}</p>
                      <p className="text-white/60 text-xs mt-0.5">{domain.name}</p>
                      <p className="text-white/30 text-[10px] mt-0.5">{domain.count} controls</p>
                    </div>
                  ))}
                </div>
                <a href="https://www.iso.org/standard/27001" target="_blank" rel="noopener noreferrer" className="text-blue-400/60 text-xs hover:text-blue-400 transition-colors inline-flex items-center gap-1">
                  <Eye size={11} /> View Standard →
                </a>
              </div>

              {/* SOC 2 */}
              <div className="hud-stat-card rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-400/10 border border-green-400/20 flex items-center justify-center">
                    <Shield size={16} className="text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">SOC 2</h3>
                    <p className="text-white/40 text-xs">Trust Service Criteria</p>
                  </div>
                  <span className="ml-auto text-[10px] nexus-mono px-2 py-1 rounded bg-green-400/10 text-green-400 border border-green-400/20">5 TSC</span>
                </div>
                <p className="text-white/50 text-xs leading-relaxed">
                  AICPA framework for service organizations, evaluating controls over security, availability, processing integrity, confidentiality, and privacy.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { letter: 'CC', name: 'Security (Common Criteria)', desc: 'Logical and physical access controls' },
                    { letter: 'A', name: 'Availability', desc: 'System availability per SLA commitments' },
                    { letter: 'PI', name: 'Processing Integrity', desc: 'Complete, accurate, timely processing' },
                    { letter: 'C', name: 'Confidentiality', desc: 'Confidential information protection' },
                    { letter: 'P', name: 'Privacy', desc: 'Personal information collection & use' },
                  ].map(tsc => (
                    <div key={tsc.letter} className="flex items-center gap-2 bg-white/3 rounded-lg p-2">
                      <span className="w-6 text-green-400 text-[10px] nexus-mono font-bold">{tsc.letter}</span>
                      <div>
                        <p className="text-white/60 text-xs">{tsc.name}</p>
                        <p className="text-white/30 text-[10px]">{tsc.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <a href="https://www.aicpa.org/resources/article/aicpa-soc-2" target="_blank" rel="noopener noreferrer" className="text-green-400/60 text-xs hover:text-green-400 transition-colors inline-flex items-center gap-1">
                  <Eye size={11} /> View Framework →
                </a>
              </div>

              {/* NIST CSF */}
              <div className="hud-stat-card rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-400/10 border border-orange-400/20 flex items-center justify-center">
                    <BookOpen size={16} className="text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">NIST CSF 2.0</h3>
                    <p className="text-white/40 text-xs">Cybersecurity Framework</p>
                  </div>
                  <span className="ml-auto text-[10px] nexus-mono px-2 py-1 rounded bg-orange-400/10 text-orange-400 border border-orange-400/20">6 Functions</span>
                </div>
                <p className="text-white/50 text-xs leading-relaxed">
                  NIST CSF 2.0 provides a risk-based approach to managing cybersecurity across six core functions, applicable to any organization.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { code: 'GV', name: 'Govern', color: 'text-purple-400' },
                    { code: 'ID', name: 'Identify', color: 'text-blue-400' },
                    { code: 'PR', name: 'Protect', color: 'text-green-400' },
                    { code: 'DE', name: 'Detect', color: 'text-yellow-400' },
                    { code: 'RS', name: 'Respond', color: 'text-orange-400' },
                    { code: 'RC', name: 'Recover', color: 'text-red-400' },
                  ].map(fn => (
                    <div key={fn.code} className="flex items-center gap-2 bg-white/3 rounded-lg p-2">
                      <span className={cn('text-[10px] nexus-mono font-bold w-6', fn.color)}>{fn.code}</span>
                      <span className="text-white/60 text-xs">{fn.name}</span>
                    </div>
                  ))}
                </div>
                <a href="https://www.nist.gov/cyberframework" target="_blank" rel="noopener noreferrer" className="text-orange-400/60 text-xs hover:text-orange-400 transition-colors inline-flex items-center gap-1">
                  <Eye size={11} /> View Framework →
                </a>
              </div>

              {/* AI Governance */}
              <div className="hud-stat-card rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-400/10 border border-violet-400/20 flex items-center justify-center">
                    <Cpu size={16} className="text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">AI Governance</h3>
                    <p className="text-white/40 text-xs">EU AI Act & Model Risk</p>
                  </div>
                  <span className="ml-auto text-[10px] nexus-mono px-2 py-1 rounded bg-violet-400/10 text-violet-400 border border-violet-400/20">EU AI Act</span>
                </div>
                <p className="text-white/50 text-xs leading-relaxed">
                  EU AI Act establishes risk-based requirements for AI systems. High-risk AI requires conformity assessments, bias controls, and model risk management.
                </p>
                <div className="space-y-2">
                  {[
                    { risk: 'Unacceptable Risk', desc: 'Prohibited AI systems (social scoring, subliminal manipulation)', color: 'text-red-400 bg-red-400/5 border-red-400/20' },
                    { risk: 'High Risk', desc: 'Critical infrastructure, biometrics, employment, credit, law enforcement', color: 'text-orange-400 bg-orange-400/5 border-orange-400/20' },
                    { risk: 'Limited Risk', desc: 'Transparency obligations — chatbots, deepfakes', color: 'text-yellow-400 bg-yellow-400/5 border-yellow-400/20' },
                    { risk: 'Minimal Risk', desc: 'AI-enabled video games, spam filters — no obligations', color: 'text-green-400 bg-green-400/5 border-green-400/20' },
                  ].map(tier => (
                    <div key={tier.risk} className={cn('rounded-lg p-2 border', tier.color)}>
                      <p className="text-xs font-medium mb-0.5">{tier.risk}</p>
                      <p className="text-[10px] opacity-70">{tier.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-white/30 text-[10px] nexus-mono">MODEL RISK CONTROLS</p>
                  {['Bias & fairness testing', 'Explainability requirements', 'Human oversight mechanisms', 'Data governance & lineage'].map(ctrl => (
                    <div key={ctrl} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-violet-400/50" />
                      <span className="text-white/50 text-xs">{ctrl}</span>
                    </div>
                  ))}
                </div>
                <a href="https://artificialintelligenceact.eu/" target="_blank" rel="noopener noreferrer" className="text-violet-400/60 text-xs hover:text-violet-400 transition-colors inline-flex items-center gap-1">
                  <Eye size={11} /> View EU AI Act →
                </a>
              </div>

            </div>
          </div>
        )}

        {/* ══ Tab 4: AI Analysis ════════════════════════════════════════════════ */}
        {activeTab === 'AI Analysis' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white font-semibold">AI Security Analysis</h2>
              <p className="text-white/40 text-xs mt-0.5">Paste security docs or controls and run NEXUS analysis</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Input panel */}
              <div className="space-y-4">
                <div className="hud-stat-card rounded-xl p-5 space-y-4">
                  <p className="text-white/50 text-xs nexus-mono tracking-wider">INPUT</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/40 text-xs block mb-1">Analysis Type</label>
                      <select
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                        value={analysisType}
                        onChange={e => setAnalysisType(e.target.value)}
                      >
                        {ANALYSIS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-white/40 text-xs block mb-1">Framework</label>
                      <select
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
                        value={analysisFramework}
                        onChange={e => setAnalysisFramework(e.target.value)}
                      >
                        {['ISO 27001', 'SOC 2', 'NIST CSF'].map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-white/40 text-xs block mb-1">Security Documentation</label>
                    <textarea
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-400/40 resize-none"
                      placeholder="Paste security policies, control descriptions, audit notes, or any security documentation here..."
                      rows={12}
                      value={analysisText}
                      onChange={e => setAnalysisText(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={runAnalysis}
                    disabled={analysisLoading || !analysisText.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/25 disabled:opacity-50 transition-all text-sm font-medium"
                  >
                    {analysisLoading ? (
                      <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
                    ) : (
                      <><Shield size={14} /> Run {analysisType}</>
                    )}
                  </button>
                </div>
              </div>

              {/* Output panel */}
              <div className="hud-stat-card rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white/50 text-xs nexus-mono tracking-wider">ANALYSIS OUTPUT</p>
                  {analysisResult && (
                    <button
                      onClick={exportReport}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-white/40 hover:text-cyan-400 hover:bg-cyan-400/10 border border-white/10 hover:border-cyan-400/20 transition-all"
                    >
                      <Download size={11} />
                      Export Report
                    </button>
                  )}
                </div>

                {analysisLoading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 size={28} className="animate-spin text-cyan-400/50" />
                    <p className="text-white/30 text-xs nexus-mono">NEXUS ANALYZING...</p>
                  </div>
                )}

                {!analysisLoading && !analysisResult && (
                  <div className="flex flex-col items-center justify-center py-16 text-white/20">
                    <FileText size={36} className="mb-3 opacity-40" />
                    <p className="text-sm">Run an analysis to see results here</p>
                  </div>
                )}

                {!analysisLoading && analysisResult && (
                  <div className="overflow-y-auto max-h-[500px] pr-1">
                    <div className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">
                      {analysisResult}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
