'use client'

import { useState, useRef, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import {
  Search,
  FileText,
  Shield,
  Bug,
  CheckSquare,
  BarChart2,
  ClipboardList,
  Upload,
  X,
  Loader2,
  Copy,
  Check,
  BookOpen,
  RefreshCw,
  ImageIcon,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalysisType = 'explain' | 'ocr' | 'security' | 'debug' | 'extract_tasks' | 'diagram' | 'summarize'

interface AnalysisOption {
  id: AnalysisType
  icon: string
  label: string
  description: string
  accent: 'cyan' | 'rose' | 'orange' | 'violet'
}

interface HistoryEntry {
  id: string
  type: AnalysisType
  label: string
  preview: string
  result: string
  timestamp: Date
}

const ANALYSIS_OPTIONS: AnalysisOption[] = [
  { id: 'explain', icon: '🔍', label: 'Explain', description: 'Describe and explain any image', accent: 'cyan' },
  { id: 'ocr', icon: '📝', label: 'OCR / Extract Text', description: 'Extract all text from images', accent: 'cyan' },
  { id: 'security', icon: '🛡', label: 'Security Review', description: 'Scan for security issues', accent: 'rose' },
  { id: 'debug', icon: '🐛', label: 'Debug Screenshot', description: 'Analyze errors and UI bugs', accent: 'orange' },
  { id: 'extract_tasks', icon: '✅', label: 'Extract Tasks', description: 'Pull action items from images', accent: 'cyan' },
  { id: 'diagram', icon: '📊', label: 'Diagram Analysis', description: 'Understand technical diagrams', accent: 'violet' },
  { id: 'summarize', icon: '📋', label: 'Summarize', description: 'Get a quick intelligent summary', accent: 'cyan' },
]

const USAGE_TIPS = [
  { tip: 'Screenshot of an error', action: 'Debug Screenshot' },
  { tip: 'Architecture diagram', action: 'Diagram Analysis' },
  { tip: 'Screenshot of a document', action: 'OCR' },
  { tip: 'UI screenshot with issues', action: 'Debug Screenshot' },
  { tip: 'Whiteboard photo', action: 'OCR + Explain' },
  { tip: 'Cloud console screenshot', action: 'Security Review' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function getAccentClasses(accent: AnalysisOption['accent'], selected: boolean) {
  const base = 'border rounded-xl p-3 cursor-pointer transition-all flex flex-col gap-1.5 text-left'
  if (!selected) {
    return `${base} border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5`
  }
  switch (accent) {
    case 'rose':
      return `${base} border-rose-400/50 bg-rose-400/10`
    case 'orange':
      return `${base} border-orange-400/50 bg-orange-400/10`
    case 'violet':
      return `${base} border-violet-400/50 bg-violet-400/10`
    default:
      return `${base} border-cyan-400/50 bg-cyan-400/10`
  }
}

function getTypeBadgeClass(type: AnalysisType): string {
  switch (type) {
    case 'security':
      return 'bg-rose-400/15 text-rose-400 border border-rose-400/20'
    case 'debug':
      return 'bg-orange-400/15 text-orange-400 border border-orange-400/20'
    case 'diagram':
      return 'bg-violet-400/15 text-violet-400 border border-violet-400/20'
    default:
      return 'bg-cyan-400/15 text-cyan-400 border border-cyan-400/20'
  }
}

// ─── SafeContent ──────────────────────────────────────────────────────────────

function SafeContent({ text, mono }: { text: string; mono?: boolean }) {
  if (mono) {
    return (
      <pre className="nexus-mono text-sm text-white/80 leading-relaxed whitespace-pre-wrap bg-black/20 rounded-xl p-4 border border-cyan-400/10 overflow-x-auto">
        {text}
      </pre>
    )
  }
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('```')) return <div key={i} className="h-px bg-white/10 my-2" />
        if (line.startsWith('# ')) return <p key={i} className="text-white font-bold text-sm mt-3">{line.slice(2)}</p>
        if (line.startsWith('## ')) return <p key={i} className="text-white/80 font-semibold text-sm mt-2">{line.slice(3)}</p>
        if (line.startsWith('- ') || line.startsWith('* ')) return <p key={i} className="text-white/70 text-sm pl-3">• {line.slice(2)}</p>
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+\.\s)(.*)$/)
          return match ? (
            <p key={i} className="text-white/70 text-sm pl-2">
              <span className="text-cyan-400/70 nexus-mono mr-1">{match[1]}</span>
              {match[2]}
            </p>
          ) : <p key={i} className="text-white/70 text-sm">{line}</p>
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VisualPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedType, setSelectedType] = useState<AnalysisType | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState<{ w: number; h: number } | null>(null)
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [resultType, setResultType] = useState<AnalysisType | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [copied, setCopied] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // ── File handling ────────────────────────────────────────────────────────

  function handleFile(file: File) {
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      toast.error('Unsupported file type. Use JPEG, PNG, GIF, or WEBP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large (max 5 MB).')
      return
    }
    const url = URL.createObjectURL(file)
    setImageFile(file)
    setImagePreview(url)
    setResult(null)
    setResultType(null)
    setImageDimensions(null)

    const img = new Image()
    img.onload = () => setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
    setImageDimensions(null)
    setResult(null)
    setResultType(null)
  }

  // ── Analysis ─────────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!imageFile || !selectedType) {
      toast.error('Select an image and analysis type first.')
      return
    }
    setLoading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('type', selectedType)
      if (context.trim()) formData.append('context', context.trim())

      const res = await fetch('/api/visual', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Analysis failed')

      const resultText: string = data.result
      setResult(resultText)
      setResultType(selectedType)

      // Add to history (keep last 5)
      const option = ANALYSIS_OPTIONS.find((o) => o.id === selectedType)!
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        type: selectedType,
        label: option.label,
        preview: resultText.slice(0, 100),
        result: resultText,
        timestamp: new Date(),
      }
      setHistory((prev) => [entry, ...prev].slice(0, 5))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Copy result ──────────────────────────────────────────────────────────

  function handleCopy() {
    if (!result) return
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => toast.error('Failed to copy'))
  }

  // ── Save to Notes ────────────────────────────────────────────────────────

  async function handleSaveNote() {
    if (!result || !resultType) return
    setSavingNote(true)
    const option = ANALYSIS_OPTIONS.find((o) => o.id === resultType)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Visual Analysis: ${option?.label ?? resultType} — ${new Date().toLocaleString()}`,
          content: result,
          tags: `visual,${resultType}`,
          pinned: false,
        }),
      })
      if (!res.ok) throw new Error('Failed to save note')
      toast.success('Saved to Notes')
    } catch {
      toast.error('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────

  function handleReset() {
    clearImage()
    setSelectedType(null)
    setContext('')
    setResult(null)
    setResultType(null)
  }

  // ── Restore from history ─────────────────────────────────────────────────

  function restoreHistory(entry: HistoryEntry) {
    setResult(entry.result)
    setResultType(entry.type)
  }

  const canAnalyze = !!imageFile && !!selectedType && !loading

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="VISUAL INTELLIGENCE" subtitle="AI-powered image & screenshot analysis" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-6 flex flex-col gap-5">

          {/* ── Analysis Type Grid ─────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ImageIcon size={13} className="text-cyan-400" />
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider nexus-mono">Analysis Type</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
              {ANALYSIS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedType((prev) => (prev === opt.id ? null : opt.id))}
                  className={getAccentClasses(opt.accent, selectedType === opt.id)}
                >
                  <span className="text-xl leading-none">{opt.icon}</span>
                  <span className={cn(
                    'text-xs font-semibold',
                    selectedType === opt.id ? 'text-white' : 'text-white/70'
                  )}>
                    {opt.label}
                  </span>
                  <span className="text-white/40 text-[10px] leading-tight">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Main 2-column layout ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Left column: Upload + Controls */}
            <div className="flex flex-col gap-4">

              {/* Upload Zone */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Upload size={13} className="text-cyan-400" />
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-wider nexus-mono">Image Upload</span>
                  </div>
                  {imageFile && (
                    <button
                      onClick={clearImage}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 text-white/40 hover:text-rose-400 hover:border-rose-400/30 transition-all text-xs"
                    >
                      <X size={11} />
                      Clear Image
                    </button>
                  )}
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {imagePreview ? (
                  <div className="flex flex-col gap-3">
                    {/* Preview */}
                    <div className="relative rounded-xl overflow-hidden border border-cyan-400/20 bg-black/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full max-h-64 object-contain"
                      />
                    </div>
                    {/* Metadata */}
                    <div className="flex flex-wrap gap-3 text-xs text-white/50 nexus-mono">
                      <span className="flex items-center gap-1">
                        <FileText size={10} className="text-cyan-400/50" />
                        {imageFile!.name}
                      </span>
                      <span>{formatBytes(imageFile!.size)}</span>
                      {imageDimensions && (
                        <span>{imageDimensions.w} × {imageDimensions.h} px</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all min-h-[200px]',
                      isDragging
                        ? 'border-cyan-400/60 bg-cyan-400/5'
                        : 'border-white/10 hover:border-cyan-400/30 hover:bg-white/2'
                    )}
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Upload size={22} className="text-white/30" />
                    </div>
                    <div className="text-center">
                      <p className="text-white/60 text-sm font-medium">Drop image here or click to upload</p>
                      <p className="text-white/25 text-xs mt-1 nexus-mono">JPEG, PNG, GIF, WEBP — max 5 MB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Context Input */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-2">
                <label className="text-white/60 text-xs font-semibold uppercase tracking-wider nexus-mono">
                  Context (optional)
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. 'This is a login page' or 'This is from our AWS console'"
                  className="nexus-input text-sm"
                />
              </div>

              {/* Analyze Button */}
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className={cn(
                  'flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-semibold text-sm transition-all border',
                  selectedType === 'security'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/60'
                    : selectedType === 'debug'
                    ? 'border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/60'
                    : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20 hover:border-cyan-400/50',
                  !canAnalyze && 'opacity-40 cursor-not-allowed'
                )}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Analyzing with Claude Vision...
                  </>
                ) : (
                  <>
                    <ImageIcon size={16} />
                    ANALYZE IMAGE
                  </>
                )}
              </button>

              {/* Usage Tips */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <BookOpen size={13} className="text-cyan-400" />
                  <span className="text-white/60 text-xs font-semibold uppercase tracking-wider nexus-mono">Usage Tips</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {USAGE_TIPS.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-white/30 nexus-mono mt-0.5">→</span>
                      <span className="text-white/50">
                        <span className="text-white/70">{tip.tip}</span>
                        {' '}
                        <span className="text-cyan-400/60">→ {tip.action}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column: Results + History */}
            <div className="flex flex-col gap-4">

              {/* Results Panel */}
              <div className="glass-panel rounded-2xl flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-400/10 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    {resultType ? (
                      <span className={cn(
                        'px-2 py-0.5 rounded-md text-xs font-semibold nexus-mono',
                        getTypeBadgeClass(resultType)
                      )}>
                        {ANALYSIS_OPTIONS.find((o) => o.id === resultType)?.label ?? resultType}
                      </span>
                    ) : (
                      <span className="text-white/40 text-xs font-semibold uppercase tracking-wider nexus-mono">
                        Analysis Result
                      </span>
                    )}
                    {result && (
                      <span className="text-white/30 text-xs">— Analysis Complete</span>
                    )}
                  </div>
                  {result && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 text-white/40 hover:text-cyan-400 hover:border-cyan-400/30 transition-all text-xs"
                      >
                        {copied ? <Check size={11} /> : <Copy size={11} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={handleSaveNote}
                        disabled={savingNote}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 text-white/40 hover:text-violet-400 hover:border-violet-400/30 transition-all text-xs disabled:opacity-40"
                      >
                        {savingNote ? <Loader2 size={11} className="animate-spin" /> : <BookOpen size={11} />}
                        Save to Notes
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all text-xs"
                      >
                        <RefreshCw size={11} />
                        New
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full border border-cyan-400/20 flex items-center justify-center">
                          <Loader2 size={22} className="text-cyan-400 animate-spin" />
                        </div>
                        <div className="absolute inset-0 rounded-full border border-cyan-400/10 animate-ping" />
                      </div>
                      <div className="text-center">
                        <p className="text-cyan-400 text-sm font-medium nexus-mono">Analyzing with Claude Vision...</p>
                        <p className="text-white/30 text-xs mt-1">Processing image with neural inference</p>
                      </div>
                    </div>
                  ) : result ? (
                    <SafeContent text={result} mono={resultType === 'ocr'} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-white/3 border border-cyan-400/10 flex items-center justify-center">
                        <ImageIcon size={24} className="text-white/15" />
                      </div>
                      <div>
                        <p className="text-white/40 text-sm font-medium">No analysis yet</p>
                        <p className="text-white/25 text-xs mt-1 max-w-xs">
                          Upload an image, select an analysis type, and click Analyze Image to get started.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Analyses */}
              {history.length > 0 && (
                <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-cyan-400" />
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-wider nexus-mono">
                      Recent Analyses
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {history.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => restoreHistory(entry)}
                        className="flex items-start gap-3 p-3 rounded-xl bg-white/3 border border-white/5 hover:border-cyan-400/20 hover:bg-white/5 transition-all text-left group"
                      >
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-semibold nexus-mono flex-shrink-0 mt-0.5',
                          getTypeBadgeClass(entry.type)
                        )}>
                          {entry.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/60 text-xs leading-relaxed line-clamp-2">
                            {entry.preview}{entry.preview.length >= 100 ? '…' : ''}
                          </p>
                          <p className="text-white/25 text-[10px] nexus-mono mt-1">{formatTime(entry.timestamp)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
