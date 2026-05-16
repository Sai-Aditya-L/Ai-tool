'use client'

import { useState, useCallback, useEffect } from 'react'
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
  GitBranch,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  File,
  Shield,
  TestTube,
  AlertTriangle,
  Search,
  ChevronRight,
  Home,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'code_review' | 'pr_summary' | 'commit_message' | 'doc_generator' | 'architecture_advisor' | 'github' | 'repo_explorer' | 'security_review' | 'test_generator' | 'stack_trace'

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
  { id: 'github', label: 'GitHub', icon: <GitBranch size={15} /> },
  { id: 'repo_explorer', label: 'Repo Explorer', icon: <FolderOpen size={15} /> },
  { id: 'security_review', label: 'Security Review', icon: <Shield size={15} /> },
  { id: 'test_generator', label: 'Test Generator', icon: <TestTube size={15} /> },
  { id: 'stack_trace', label: 'Stack Trace', icon: <AlertTriangle size={15} /> },
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

function SafeContent({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('```')) return <div key={i} className="h-px bg-white/10 my-2" />
        if (line.startsWith('# ')) return <p key={i} className="text-white font-bold text-sm mt-3">{line.slice(2)}</p>
        if (line.startsWith('## ')) return <p key={i} className="text-white/80 font-semibold text-sm mt-2">{line.slice(3)}</p>
        if (line.startsWith('- ') || line.startsWith('* ')) return <p key={i} className="text-white/70 text-sm pl-3">• {line.slice(2)}</p>
        if (line.trim() === '') return <div key={i} className="h-1" />
        // inline code: `code`
        const parts = line.split(/(`[^`]+`)/)
        return (
          <p key={i} className="text-white/70 text-sm">
            {parts.map((p, j) => p.startsWith('`') && p.endsWith('`')
              ? <code key={j} className="bg-white/10 px-1 rounded text-cyan-300 text-xs font-mono">{p.slice(1, -1)}</code>
              : p
            )}
          </p>
        )
      })}
    </div>
  )
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
            <SafeContent text={result} />
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

// ─── Tab 6: GitHub ───────────────────────────────────────────────────────────

interface GitHubRepo {
  name: string
  full_name: string
  description: string | null
  stargazers_count: number
  language: string | null
  updated_at: string
}

interface GitHubPR {
  number: number
  title: string
  user: { login: string }
  head: { ref: string }
  html_url: string
}

function GitHubTab() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [prs, setPRs] = useState<GitHubPR[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [loadingPRs, setLoadingPRs] = useState(false)
  const [reviewResult, setReviewResult] = useState('')
  const [reviewingPR, setReviewingPR] = useState<number | null>(null)
  const [commitResult, setCommitResult] = useState('')
  const [loadingCommits, setLoadingCommits] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    setLoadingRepos(true)
    try {
      const res = await fetch('/api/dev/github')
      const data = await res.json()
      setConnected(data.connected)
      setRepos(data.repos || [])
    } catch {
      setConnected(false)
    } finally {
      setLoadingRepos(false)
    }
  }

  async function fetchPRs(repoFullName: string) {
    setSelectedRepo(repoFullName)
    setPRs([])
    setReviewResult('')
    setCommitResult('')
    if (!repoFullName) return
    setLoadingPRs(true)
    try {
      const res = await fetch(`/api/dev/github/prs?repo=${encodeURIComponent(repoFullName)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load PRs')
      setPRs(data.prs || [])
    } catch (err: any) {
      toast.error(err.message || 'Failed to load PRs')
    } finally {
      setLoadingPRs(false)
    }
  }

  async function reviewPR(pr: GitHubPR) {
    setReviewingPR(pr.number)
    setReviewResult('')
    try {
      const res = await fetch('/api/dev/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'pr_review',
          input: { prTitle: pr.title, prNumber: String(pr.number), repo: selectedRepo },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Review failed')
      setReviewResult(data.result)
    } catch (err: any) {
      toast.error(err.message || 'PR review failed')
    } finally {
      setReviewingPR(null)
    }
  }

  async function listCommits() {
    if (!selectedRepo) { toast.error('Select a repository first'); return }
    setLoadingCommits(true)
    setCommitResult('')
    try {
      const res = await fetch('/api/dev/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'commit_summary',
          input: { repo: selectedRepo },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setCommitResult(data.result)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load commits')
    } finally {
      setLoadingCommits(false)
    }
  }

  if (connected === null || loadingRepos) {
    return (
      <div className="flex items-center justify-center py-24 gap-3">
        <Loader2 size={18} className="text-cyan-400 animate-spin" />
        <span className="text-white/40 text-sm">Checking GitHub connection...</span>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/3 border border-cyan-400/10 flex items-center justify-center">
          <GitBranch size={24} className="text-white/20" />
        </div>
        <div className="text-center">
          <p className="text-white/70 font-medium">GitHub not connected</p>
          <p className="text-white/30 text-sm mt-1">Connect your GitHub account to view repos and PRs</p>
        </div>
        <a
          href="/api/integrations/github/auth"
          className="nexus-btn-primary flex items-center gap-2 px-6 py-2.5"
        >
          <GitBranch size={15} />
          Connect GitHub
        </a>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* Left panel */}
      <div className="flex flex-col gap-3">
        {/* Repo selector */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Repository</label>
            <button
              onClick={fetchStatus}
              className="flex items-center gap-1 text-white/30 hover:text-cyan-400 transition-colors text-xs"
            >
              <RefreshCw size={11} />
              Refresh
            </button>
          </div>
          <select
            value={selectedRepo}
            onChange={e => fetchPRs(e.target.value)}
            className="nexus-input"
          >
            <option value="">Select a repository...</option>
            {repos.map(r => (
              <option key={r.full_name} value={r.full_name}>
                {r.full_name} {r.language ? `(${r.language})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* PR List */}
        {selectedRepo && (
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Open Pull Requests</label>
              <button
                onClick={listCommits}
                disabled={loadingCommits}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyan-400/20 text-white/50 hover:text-cyan-400 hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all text-xs disabled:opacity-40"
              >
                {loadingCommits ? <Loader2 size={11} className="animate-spin" /> : <GitCommit size={11} />}
                List Commits
              </button>
            </div>

            {loadingPRs ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 size={15} className="text-cyan-400 animate-spin" />
                <span className="text-white/40 text-sm">Loading PRs...</span>
              </div>
            ) : prs.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-4">No open pull requests</p>
            ) : (
              <div className="flex flex-col gap-2">
                {prs.map(pr => (
                  <div
                    key={pr.number}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/3 border border-white/5 hover:border-cyan-400/20 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white/30 text-xs nexus-mono">#{pr.number}</span>
                        <p className="text-white/80 text-sm font-medium truncate">{pr.title}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-white/30 text-xs">{pr.user.login}</span>
                        <span className="text-cyan-400/50 text-xs nexus-mono">{pr.head.ref}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <a
                        href={pr.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-white/10 text-white/30 hover:text-cyan-400 hover:border-cyan-400/30 transition-all"
                        title="Open on GitHub"
                      >
                        <ExternalLink size={12} />
                      </a>
                      <button
                        onClick={() => reviewPR(pr)}
                        disabled={reviewingPR === pr.number}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyan-400/20 text-white/50 hover:text-cyan-400 hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all text-xs disabled:opacity-40"
                      >
                        {reviewingPR === pr.number ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                        Review PR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right panel — AI output */}
      <ResultPanel
        result={reviewResult || commitResult}
        loading={reviewingPR !== null || loadingCommits}
        placeholder="Select a repo, then click Review PR or List Commits to get AI analysis."
      />
    </div>
  )
}

// ─── Tab 7: Repo Explorer ────────────────────────────────────────────────────

const FILE_ICON_MAP: Record<string, string> = {
  ts: 'text-blue-400', tsx: 'text-blue-400', js: 'text-yellow-400', jsx: 'text-yellow-400',
  py: 'text-green-400', go: 'text-cyan-400', rs: 'text-orange-400', json: 'text-yellow-300',
  md: 'text-white/60', css: 'text-pink-400', html: 'text-orange-300', sh: 'text-green-300',
}

function fileColor(name: string) {
  const ext = name.split('.').pop() ?? ''
  return FILE_ICON_MAP[ext] ?? 'text-white/40'
}

interface FileEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  size: number
  sha: string
}

interface SearchEntry {
  name: string
  path: string
  html_url: string
  score: number
}

type ActiveView = 'tree' | 'file' | 'search' | 'summary'

function RepoExplorerTab() {
  const [repos, setRepos] = useState<{ full_name: string; name: string }[]>([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [currentPath, setCurrentPath] = useState('')
  const [fileTree, setFileTree] = useState<FileEntry[]>([])
  const [fileContent, setFileContent] = useState('')
  const [selectedFile, setSelectedFile] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchEntry[]>([])
  const [repoDetails, setRepoDetails] = useState<any>(null)
  const [activeView, setActiveView] = useState<ActiveView>('tree')
  const [loading, setLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    fetch('/api/dev/github')
      .then(r => r.json())
      .then(d => setRepos(d.repos || []))
      .catch(() => {})
  }, [])

  async function browseDir(repo: string, path: string) {
    setLoading(true)
    setFileContent('')
    setSelectedFile('')
    try {
      const res = await fetch(`/api/dev/github/files?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      const sorted = (data.contents as FileEntry[]).sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name)
        return a.type === 'dir' ? -1 : 1
      })
      setFileTree(sorted)
      setCurrentPath(path)
      setActiveView('tree')
    } catch (err: any) {
      toast.error(err.message || 'Failed to load directory')
    } finally {
      setLoading(false)
    }
  }

  async function loadFile(repo: string, path: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/dev/github/files?repo=${encodeURIComponent(repo)}&file=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setFileContent(data.file.content)
      setSelectedFile(path)
      setActiveView('file')
    } catch (err: any) {
      toast.error(err.message || 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) { toast.error('Enter a search query'); return }
    if (!selectedRepo) { toast.error('Select a repo first'); return }
    setLoading(true)
    setSearchResults([])
    setActiveView('search')
    try {
      const res = await fetch(`/api/dev/github/files?repo=${encodeURIComponent(selectedRepo)}&search=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setSearchResults(data.results || [])
    } catch (err: any) {
      toast.error(err.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleFindTodos() {
    if (!selectedRepo) { toast.error('Select a repo first'); return }
    setLoading(true)
    setSearchResults([])
    setActiveView('search')
    try {
      const res = await fetch(`/api/dev/github/files?repo=${encodeURIComponent(selectedRepo)}&search=${encodeURIComponent('TODO FIXME')}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      const results: SearchEntry[] = data.results || []
      setSearchResults(results)
      if (results.length > 0) {
        setAiLoading(true)
        const summary = results.map(r => `${r.path}: ${r.name}`).join('\n')
        const aiRes = await fetch('/api/dev/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'find_todos', input: { searchResults: summary } }),
        })
        const aiData = await aiRes.json()
        if (aiRes.ok) setAiResult(aiData.result)
        setAiLoading(false)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed')
      setAiLoading(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleSummarize() {
    if (!selectedRepo) { toast.error('Select a repo first'); return }
    setActiveView('summary')
    setAiLoading(true)
    setAiResult('')
    try {
      const res = await fetch(`/api/dev/github/files?repo=${encodeURIComponent(selectedRepo)}&details=1`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      const details = data.details
      setRepoDetails(details)
      const langs = Object.keys(details.languages || {}).join(', ')
      const aiRes = await fetch('/api/dev/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'summarize_repo',
          input: {
            repoName: details.name,
            description: details.description || '',
            readme: details.readme || '',
            languages: langs,
            topics: (details.topics || []).join(', '),
          },
        }),
      })
      const aiData = await aiRes.json()
      if (!aiRes.ok) throw new Error(aiData.error || 'AI failed')
      setAiResult(aiData.result)
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    } finally {
      setAiLoading(false)
    }
  }

  function handleRepoChange(repoName: string) {
    setSelectedRepo(repoName)
    setCurrentPath('')
    setFileTree([])
    setFileContent('')
    setSelectedFile('')
    setSearchResults([])
    setAiResult('')
    setRepoDetails(null)
    setActiveView('tree')
    if (repoName) browseDir(repoName, '')
  }

  function navigateBreadcrumb(idx: number) {
    const parts = currentPath.split('/').filter(Boolean)
    const newPath = parts.slice(0, idx).join('/')
    browseDir(selectedRepo, newPath)
  }

  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* Left panel */}
      <div className="flex flex-col gap-3">
        {/* Repo selector */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
          <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Repository</label>
          <select
            value={selectedRepo}
            onChange={e => handleRepoChange(e.target.value)}
            className="nexus-input"
          >
            <option value="">Select a repository...</option>
            {repos.map(r => (
              <option key={r.full_name} value={r.full_name}>{r.full_name}</option>
            ))}
          </select>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => selectedRepo && browseDir(selectedRepo, '')}
              disabled={!selectedRepo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-400/20 text-white/50 hover:text-cyan-400 hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all text-xs disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <FolderOpen size={12} />
              Browse Files
            </button>
            <button
              onClick={handleFindTodos}
              disabled={!selectedRepo || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-yellow-400/20 text-white/50 hover:text-yellow-400 hover:border-yellow-400/40 hover:bg-yellow-400/5 transition-all text-xs disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Search size={12} />
              Find TODOs
            </button>
            <button
              onClick={handleSummarize}
              disabled={!selectedRepo || aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-400/20 text-white/50 hover:text-purple-400 hover:border-purple-400/40 hover:bg-purple-400/5 transition-all text-xs disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <BookOpen size={12} />
              Summarize Repo
            </button>
          </div>
        </div>

        {/* Code Search */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
          <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Search Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search code in repo..."
              className="nexus-input flex-1 text-sm"
            />
            <button
              onClick={handleSearch}
              disabled={!selectedRepo || loading}
              className="nexus-btn-primary flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-40"
            >
              {loading && activeView === 'search' ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            </button>
          </div>
        </div>

        {/* File tree / browser */}
        {activeView === 'tree' && selectedRepo && (
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3 flex-1">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => browseDir(selectedRepo, '')}
                className="flex items-center gap-1 text-cyan-400/70 hover:text-cyan-400 text-xs nexus-mono transition-colors"
              >
                <Home size={11} />
                root
              </button>
              {breadcrumbs.map((crumb, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  <ChevronRight size={10} className="text-white/20" />
                  <button
                    onClick={() => navigateBreadcrumb(idx + 1)}
                    className={cn(
                      'text-xs nexus-mono transition-colors',
                      idx === breadcrumbs.length - 1
                        ? 'text-white/70'
                        : 'text-cyan-400/70 hover:text-cyan-400'
                    )}
                  >
                    {crumb}
                  </button>
                </span>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 size={15} className="text-cyan-400 animate-spin" />
                <span className="text-white/40 text-sm">Loading...</span>
              </div>
            ) : fileTree.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-4">Select a repository to browse files</p>
            ) : (
              <div className="flex flex-col gap-0.5 overflow-y-auto max-h-80">
                {fileTree.map(entry => (
                  <button
                    key={entry.path}
                    onClick={() => entry.type === 'dir'
                      ? browseDir(selectedRepo, entry.path)
                      : loadFile(selectedRepo, entry.path)
                    }
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 hover:border-cyan-400/10 border border-transparent transition-all text-left group"
                  >
                    {entry.type === 'dir'
                      ? <FolderOpen size={14} className="text-yellow-400/70 flex-shrink-0" />
                      : <File size={14} className={cn('flex-shrink-0', fileColor(entry.name))} />
                    }
                    <span className={cn(
                      'text-sm truncate nexus-mono',
                      entry.type === 'dir' ? 'text-yellow-400/80' : 'text-white/70'
                    )}>
                      {entry.name}
                    </span>
                    {entry.type === 'file' && entry.size > 0 && (
                      <span className="ml-auto text-white/20 text-xs flex-shrink-0">
                        {entry.size < 1024 ? `${entry.size}B` : `${(entry.size / 1024).toFixed(1)}K`}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search results list */}
        {activeView === 'search' && (
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3 flex-1">
            <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Search Results</label>
            {loading ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 size={15} className="text-cyan-400 animate-spin" />
                <span className="text-white/40 text-sm">Searching...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-4">No results found</p>
            ) : (
              <div className="flex flex-col gap-1 overflow-y-auto max-h-80">
                {searchResults.map((r, i) => (
                  <a
                    key={i}
                    href={r.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-cyan-400/10 transition-all"
                  >
                    <File size={13} className={fileColor(r.name)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/70 text-xs nexus-mono truncate">{r.path}</p>
                    </div>
                    <ExternalLink size={11} className="text-white/20 flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex flex-col gap-3 h-full">
        {activeView === 'file' && selectedFile ? (
          <div className="glass-panel rounded-2xl flex flex-col h-full min-h-[300px]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-400/10 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <File size={13} className={fileColor(selectedFile)} />
                <span className="text-white/60 text-xs nexus-mono truncate">{selectedFile}</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(fileContent).then(() => toast.success('Copied!'))}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyan-400/20 text-white/50 hover:text-cyan-400 hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all text-xs flex-shrink-0"
              >
                <Copy size={12} />
                Copy
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="nexus-mono text-xs text-white/75 leading-relaxed whitespace-pre-wrap">
                {fileContent}
              </pre>
            </div>
          </div>
        ) : (
          <ResultPanel
            result={aiResult}
            loading={aiLoading}
            placeholder={
              activeView === 'summary'
                ? 'Click Summarize Repo to get an AI-powered overview of the repository.'
                : activeView === 'search'
                ? 'Search results will appear on the left. Click Find TODOs for an AI summary.'
                : 'Select a repository and browse files, search code, find TODOs, or summarize the repo.'
            }
          />
        )}
      </div>
    </div>
  )
}

// ─── Tab 8: Security Review ──────────────────────────────────────────────────

function SecurityReviewTab() {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('auto-detect')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleScan() {
    if (!code.trim()) { toast.error('Paste some code first'); return }
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/dev/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'security_review',
          input: {
            code,
            language: language === 'auto-detect' ? 'auto' : language,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data.result)
    } catch (err: any) {
      toast.error(err.message || 'Security scan failed')
    } finally {
      setLoading(false)
    }
  }

  function copyResult() {
    if (!result) return
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => toast.error('Failed to copy'))
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
            placeholder="Paste your code here for security analysis..."
            className="nexus-input nexus-mono text-xs leading-relaxed resize-none"
            style={{ minHeight: '340px', fontFamily: 'var(--font-mono, monospace)' }}
          />
        </div>

        <button
          onClick={handleScan}
          disabled={loading || !code.trim()}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/60 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
          Security Scan
        </button>
      </div>

      {/* Right – Result (Sentinel theme) */}
      <div className="glass-panel rounded-2xl flex flex-col h-full min-h-[300px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-rose-500/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={13} className="text-rose-400" />
            <span className="text-white/60 text-xs font-semibold uppercase tracking-wider nexus-mono">Sentinel Output</span>
          </div>
          {result && (
            <button
              onClick={copyResult}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-500/20 text-white/50 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/5 transition-all text-xs"
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
                <div className="w-10 h-10 rounded-full border border-rose-500/20 flex items-center justify-center">
                  <Loader2 size={18} className="text-rose-400 animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full border border-rose-500/10 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-rose-400 text-sm font-medium nexus-mono">Sentinel is scanning...</p>
                <p className="text-white/30 text-xs mt-1">Analyzing for security vulnerabilities</p>
              </div>
            </div>
          ) : result ? (
            <SafeContent text={result} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-white/3 border border-rose-500/10 flex items-center justify-center">
                <Shield size={20} className="text-white/20" />
              </div>
              <p className="text-white/30 text-sm max-w-xs">Paste code on the left and click Security Scan to get a detailed vulnerability report from Sentinel.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab 9: Test Generator ───────────────────────────────────────────────────

const TEST_FRAMEWORKS = ['Jest', 'Vitest', 'PyTest', 'Go Test', 'JUnit', 'RSpec', 'Other']

function TestGeneratorTab() {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('auto-detect')
  const [framework, setFramework] = useState('Jest')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  async function handleGenerate() {
    if (!code.trim()) { toast.error('Paste some code first'); return }
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/dev/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'test_generator',
          input: {
            code,
            language: language === 'auto-detect' ? 'auto' : language,
            framework,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data.result)
    } catch (err: any) {
      toast.error(err.message || 'Test generation failed')
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
            <div className="flex gap-2">
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="nexus-input text-xs py-1.5 px-2 w-auto"
              >
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select
                value={framework}
                onChange={e => setFramework(e.target.value)}
                className="nexus-input text-xs py-1.5 px-2 w-auto"
              >
                {TEST_FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Paste the code you want to generate tests for..."
            className="nexus-input nexus-mono text-xs leading-relaxed resize-none"
            style={{ minHeight: '340px', fontFamily: 'var(--font-mono, monospace)' }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !code.trim()}
          className="nexus-btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <TestTube size={15} />}
          Generate Tests
        </button>
      </div>

      <ResultPanel
        result={result}
        loading={loading}
        placeholder="Paste code on the left, choose a language and framework, then click Generate Tests."
        mono
      />
    </div>
  )
}

// ─── Tab 10: Stack Trace Analyzer ────────────────────────────────────────────

function StackTraceTab() {
  const [stackTrace, setStackTrace] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  async function handleAnalyze() {
    if (!stackTrace.trim()) { toast.error('Paste a stack trace or error message first'); return }
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/dev/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'explain_stack_trace',
          input: { stackTrace, context },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data.result)
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      <div className="flex flex-col gap-3">
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
          <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Stack Trace / Error</label>
          <textarea
            value={stackTrace}
            onChange={e => setStackTrace(e.target.value)}
            placeholder="Paste your stack trace or error message here..."
            className="nexus-input nexus-mono text-xs leading-relaxed resize-none"
            style={{ minHeight: '260px', fontFamily: 'var(--font-mono, monospace)' }}
          />
        </div>

        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
          <label className="text-white/60 text-xs uppercase tracking-wider nexus-mono">Context (optional)</label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="What were you doing when this error occurred? Any recent changes?"
            className="nexus-input resize-none"
            style={{ minHeight: '100px' }}
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !stackTrace.trim()}
          className="nexus-btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <AlertTriangle size={15} />}
          Analyze Error
        </button>
      </div>

      <ResultPanel
        result={result}
        loading={loading}
        placeholder="Paste your stack trace on the left and click Analyze Error to get a detailed explanation and fix from Forge."
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
  github: <GitHubTab />,
  repo_explorer: <RepoExplorerTab />,
  security_review: <SecurityReviewTab />,
  test_generator: <TestGeneratorTab />,
  stack_trace: <StackTraceTab />,
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
