'use client'

import { useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import {
  Code,
  GitPullRequest,
  GitCommit,
  FileText,
  Layout,
  Copy,
  Check,
  Loader2,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'code_review' | 'pr_summary' | 'commit_message' | 'doc_generator' | 'architecture_advisor'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: Tab[] = [
  { id: 'code_review', label: 'Code Review', icon: <Code size={15} /> },
  { id: 'pr_summary', label: 'PR Summary', icon: <GitPullRequest size={15} /> },
  { id: 'commit_message', label: 'Commit Message', icon: <GitCommit size={15} /> },
  { id: 'doc_generator', label: 'Doc Generator', icon: <FileText size={15} /> },
  { id: 'architecture_advisor', label: 'Architecture Advisor', icon: <Layout size={15} /> },
]

const LANGUAGES = ['auto-detect', 'JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'Other']
const DOC_STYLES = ['JSDoc', 'TypeDoc', 'Python Docstring', 'Markdown', 'Plain English']
const FOCUS_AREAS = [
  'System Design',
  'Database Design',
  'API Design',
  'Security',
  'Performance',
  'Scalability',
  'Tech Stack Selection',
]
const COMMIT_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf']
const REVIEW_FOCUSES = [
  'Security vulnerabilities',
  'Performance issues',
  'Code style & best practices',
  'Logic errors',
  'Documentation gaps',
]

// ─── Shared helpers ─────────────────────────────────────────────────────────────

function formatContent(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-cyan-400/10 text-cyan-400 px-1 py-0.5 rounded text-sm nexus-mono">$1</code>')
    .replace(/^## (.*$)/gm, '<h3 class="text-white font-semibold mt-4 mb-1.5 text-base flex items-center gap-2"><span class="w-1 h-4 bg-cyan-400 rounded-full inline-block"></span>$1</h3>')
    .replace(/^# (.*$)/gm, '<h2 class="text-white font-bold mt-4 mb-2 text-lg">$1</h2>')
    .replace(/^- \[ \] (.*$)/gm, '<label class="flex items-center gap-2 py-0.5"><input type="checkbox" class="accent-cyan-400" /> <span>$1</span></label>')
    .replace(/^- (.*$)/gm, '<li class="flex gap-2 py-0.5"><span class="text-cyan-400 mt-1 flex-shrink-0">•</span><span>$1</span></li>')
    .replace(/\n/g, '<br/>')
}

// ─── Result Panel ────────────────────────────────────────────────────────────

interface ResultPanelProps {
  result: string
  loading: boolean
  placeholder: string
  mono?: boolean
}

function ResultPanel({ result, loading, placeholder, mono = false }: ResultPanelProps) {
  const [copied, setCopied] = useState(false)

  function copyResult() {
    if (!result) return
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => toast.error('Failed to copy'))
  }

  return (
    <div className="glass-panel rounded-2xl flex flex-col h-full min-h-[300px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-400/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-cyan-400" />
          <span className="text-white/60 text-xs font-semibold uppercase tracking-wider nexus-mono">Forge Output</span>
        </div>
        {result && (
          <button
            onClick={copyResult}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyan-400/20 text-white/50 hover:text-cyan-400 hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all text-xs"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy Result'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border border-cyan-400/20 flex items-center justify-center">
                <Loader2 size={18} className="text-cyan-400 animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full border border-cyan-400/10 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-cyan-400 text-sm font-medium nexus-mono">Forge is analyzing...</p>
              <p className="text-white/30 text-xs mt-1">Processing with neural inference</p>
            </div>
          </div>
        ) : result ? (
          mono ? (
            <pre className="nexus-mono text-sm text-white/80 leading-relaxed whitespace-pre-wrap bg-black/20 rounded-xl p-4 border border-cyan-400/10 overflow-x-auto">
              {result}
            </pre>
          ) : (
            <div
              className="text-white/80 text-sm leading-relaxed space-y-0.5"
              dangerouslySetInnerHTML={{ __html: formatContent(result) }}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/3 border border-cyan-400/10 flex items-center justify-center">
              <Zap size={20} className="text-white/20" />
            </div>
            <p className="text-white/30 text-sm max-w-xs">{placeholder}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab 1: Code Review ─────────────────────────────────────────────────────

function CodeReviewTab() {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('auto-detect')
  const [focuses, setFocuses] = useState<string[]>(['Security vulnerabilities', 'Performance issues'])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  function toggleFocus(f: string) {
    setFocuses(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  async function handleReview() {
    if (!code.trim()) { toast.error('Paste some code first'); return }
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/dev/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'code_review',
          input: {
            code,
            language: language === 'auto-detect' ? 'auto' : language,
            focus: focuses.join(', '),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data.result)
    } catch (err: any) {
      toast.error(err.message || 'Review failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* Left – Input */}
      <div className="flex flex-col gap-3">
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Code Input</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="nexus-input text-xs py-1.5 px-2 w-auto"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Paste your code here..."
            className="nexus-input nexus-mono text-xs leading-relaxed resize-none"
            style={{ minHeight: '300px', fontFamily: 'var(--font-mono, monospace)' }}
          />
        </div>

        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
          <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Review Focus</label>
          <div className="flex flex-col gap-1.5">
            {REVIEW_FOCUSES.map(f => (
              <label key={f} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={focuses.includes(f)}
                  onChange={() => toggleFocus(f)}
                  className="accent-cyan-400 w-3.5 h-3.5"
                />
                <span className={cn(
                  'text-sm transition-colors',
                  focuses.includes(f) ? 'text-white/80' : 'text-white/40 group-hover:text-white/60'
                )}>{f}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleReview}
          disabled={loading || !code.trim()}
          className="nexus-btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Code size={15} />}
          Review Code
        </button>
      </div>

      {/* Right – Result */}
      <ResultPanel
        result={result}
        loading={loading}
        placeholder="Paste code on the left and click Review to get a detailed analysis from Forge."
      />
    </div>
  )
}

// ─── Tab 2: PR Summary ───────────────────────────────────────────────────────

function PRSummaryTab() {
  const [diff, setDiff] = useState('')
  const [prTitle, setPrTitle] = useState('')
  const [baseBranch, setBaseBranch] = useState('main')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  async function handleGenerate() {
    if (!diff.trim()) { toast.error('Paste a git diff or describe the changes'); return }
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/dev/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'pr_summary',
          input: { diff, prTitle, baseBranch },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data.result)
    } catch (err: any) {
      toast.error(err.message || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      <div className="flex flex-col gap-3">
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
          <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">PR Details</label>
          <input
            type="text"
            placeholder="PR title (optional)"
            value={prTitle}
            onChange={e => setPrTitle(e.target.value)}
            className="nexus-input"
          />
          <input
            type="text"
            placeholder="Base branch"
            value={baseBranch}
            onChange={e => setBaseBranch(e.target.value)}
            className="nexus-input"
          />
          <textarea
            value={diff}
            onChange={e => setDiff(e.target.value)}
            placeholder="Paste your git diff or describe the changes..."
            className="nexus-input nexus-mono text-xs leading-relaxed resize-none"
            style={{ minHeight: '280px', fontFamily: 'var(--font-mono, monospace)' }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !diff.trim()}
          className="nexus-btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <GitPullRequest size={15} />}
          Generate PR Summary
        </button>
      </div>

      <ResultPanel
        result={result}
        loading={loading}
        placeholder="Paste your diff or describe the changes, then click Generate to get a formatted PR summary."
      />
    </div>
  )
}

// ─── Tab 3: Commit Message ───────────────────────────────────────────────────

function CommitMessageTab() {
  const [diff, setDiff] = useState('')
  const [commitType, setCommitType] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    if (!diff.trim()) { toast.error('Paste your staged diff first'); return }
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/dev/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'commit_message',
          input: { diff, commitType },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data.result)
    } catch (err: any) {
      toast.error(err.message || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  function copyCommit() {
    if (!result) return
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      toast.success('Commit message copied!')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => toast.error('Copy failed'))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      <div className="flex flex-col gap-3">
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
          <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Commit Type</label>
          <div className="flex flex-wrap gap-2">
            {COMMIT_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setCommitType(prev => prev === t ? '' : t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs nexus-mono font-medium transition-all',
                  commitType === t
                    ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-400'
                    : 'border-white/10 bg-white/3 text-white/40 hover:border-cyan-400/20 hover:text-white/70'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3 flex-1">
          <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Staged Diff</label>
          <textarea
            value={diff}
            onChange={e => setDiff(e.target.value)}
            placeholder="Paste your staged diff (git diff --staged)..."
            className="nexus-input nexus-mono text-xs leading-relaxed resize-none flex-1"
            style={{ minHeight: '260px', fontFamily: 'var(--font-mono, monospace)' }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !diff.trim()}
          className="nexus-btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <GitCommit size={15} />}
          Generate Commit Message
        </button>
      </div>

      {/* Result with dedicated copy button */}
      <div className="flex flex-col gap-3">
        <div className="glass-panel rounded-2xl flex flex-col h-full min-h-[300px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-400/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Zap size={13} className="text-cyan-400" />
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider nexus-mono">Forge Output</span>
            </div>
            {result && (
              <button
                onClick={copyCommit}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyan-400/20 text-white/50 hover:text-cyan-400 hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all text-xs"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                Copy to Clipboard
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border border-cyan-400/20 flex items-center justify-center">
                    <Loader2 size={18} className="text-cyan-400 animate-spin" />
                  </div>
                  <div className="absolute inset-0 rounded-full border border-cyan-400/10 animate-ping" />
                </div>
                <div className="text-center">
                  <p className="text-cyan-400 text-sm font-medium nexus-mono">Forge is analyzing...</p>
                  <p className="text-white/30 text-xs mt-1">Processing with neural inference</p>
                </div>
              </div>
            ) : result ? (
              <pre className="nexus-mono text-sm text-white/80 leading-relaxed whitespace-pre-wrap bg-black/20 rounded-xl p-4 border border-cyan-400/10">
                {result}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-white/3 border border-cyan-400/10 flex items-center justify-center">
                  <GitCommit size={20} className="text-white/20" />
                </div>
                <p className="text-white/30 text-sm max-w-xs">Paste your staged diff and click Generate to get a conventional commit message.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 4: Doc Generator ────────────────────────────────────────────────────

function DocGeneratorTab() {
  const [code, setCode] = useState('')
  const [docStyle, setDocStyle] = useState('JSDoc')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  async function handleGenerate() {
    if (!code.trim()) { toast.error('Paste some code or a function first'); return }
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/dev/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'doc_generator',
          input: { code, docStyle },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data.result)
    } catch (err: any) {
      toast.error(err.message || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      <div className="flex flex-col gap-3">
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Code Input</label>
            <select
              value={docStyle}
              onChange={e => setDocStyle(e.target.value)}
              className="nexus-input text-xs py-1.5 px-2 w-auto"
            >
              {DOC_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Paste your code, function, or class..."
            className="nexus-input nexus-mono text-xs leading-relaxed resize-none"
            style={{ minHeight: '320px', fontFamily: 'var(--font-mono, monospace)' }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !code.trim()}
          className="nexus-btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
          Generate Documentation
        </button>
      </div>

      <ResultPanel
        result={result}
        loading={loading}
        placeholder="Paste your code on the left, choose a doc style, then click Generate."
        mono
      />
    </div>
  )
}

// ─── Tab 5: Architecture Advisor ─────────────────────────────────────────────

function ArchitectureAdvisorTab() {
  const [description, setDescription] = useState('')
  const [focusArea, setFocusArea] = useState('System Design')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  async function handleGenerate() {
    if (!description.trim()) { toast.error('Describe your system or requirements'); return }
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/dev/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'architecture_advisor',
          input: { description, focusArea },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data.result)
    } catch (err: any) {
      toast.error(err.message || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      <div className="flex flex-col gap-3">
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Focus Area</label>
            <select
              value={focusArea}
              onChange={e => setFocusArea(e.target.value)}
              className="nexus-input text-xs py-1.5 px-2 w-auto"
            >
              {FOCUS_AREAS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe your system, problem, or requirements..."
            className="nexus-input resize-none"
            style={{ minHeight: '340px' }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          className="nexus-btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Layout size={15} />}
          Get Recommendations
        </button>
      </div>

      <ResultPanel
        result={result}
        loading={loading}
        placeholder="Describe your system or requirements on the left, then click Get Recommendations."
      />
    </div>
  )
}

// ─── Tab content map ─────────────────────────────────────────────────────────

const TAB_CONTENT: Record<TabId, React.ReactNode> = {
  code_review: <CodeReviewTab />,
  pr_summary: <PRSummaryTab />,
  commit_message: <CommitMessageTab />,
  doc_generator: <DocGeneratorTab />,
  architecture_advisor: <ArchitectureAdvisorTab />,
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DevPage() {
  const [activeTab, setActiveTab] = useState<TabId>('code_review')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Dev Workspace" subtitle="AI-powered development tools" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-6 flex flex-col gap-4 min-h-full">

          {/* Tab bar */}
          <div className="flex items-center gap-1 p-1 glass-panel rounded-xl overflow-x-auto flex-shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0',
                  activeTab === tab.id
                    ? 'bg-cyan-400/10 border border-cyan-400/30 text-cyan-400'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
                )}
              >
                <span className={cn('transition-colors', activeTab === tab.id ? 'text-cyan-400' : 'text-white/30')}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}

            <div className="ml-auto flex-shrink-0 pl-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400/5 border border-cyan-400/10">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-400/70 text-xs nexus-mono">Forge AI</span>
              </div>
            </div>
          </div>

          {/* Active tab content */}
          <div className="flex-1">
            {TAB_CONTENT[activeTab]}
          </div>

        </div>
      </div>
    </div>
  )
}
