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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'code_review' | 'pr_summary' | 'commit_message' | 'doc_generator' | 'architecture_advisor' | 'github'

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

// ─── Tab content map ─────────────────────────────────────────────────────────

const TAB_CONTENT: Record<TabId, React.ReactNode> = {
  code_review: <CodeReviewTab />,
  pr_summary: <PRSummaryTab />,
  commit_message: <CommitMessageTab />,
  doc_generator: <DocGeneratorTab />,
  architecture_advisor: <ArchitectureAdvisorTab />,
  github: <GitHubTab />,
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
