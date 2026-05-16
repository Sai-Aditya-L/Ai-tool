'use client'

import { useState, useCallback, useRef } from 'react'
import { Header } from '@/components/layout/header'
import { FileText, Upload, X, Brain, Save, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

interface DocResult {
  filename: string
  text: string
  pageCount?: number
  wordCount: number
  type: string
}

interface Analysis {
  analysis: string
  filename: string
}

export default function DocumentsPage() {
  const [dragging, setDragging] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [doc, setDoc] = useState<DocResult | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [instruction, setInstruction] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    setError('')
    setDoc(null)
    setAnalysis(null)
    setExtracting(true)

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/documents/extract', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setDoc(data)

      // Auto-analyze
      setAnalyzing(true)
      const ar = await fetch('/api/documents/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.text, filename: data.filename }),
      })
      const ad = await ar.json()
      if (ar.ok) setAnalysis(ad)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process document')
    } finally {
      setExtracting(false)
      setAnalyzing(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleAnalyzeCustom = async () => {
    if (!doc || !instruction.trim()) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/documents/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: doc.text, filename: doc.filename, instruction }),
      })
      const data = await res.json()
      if (res.ok) setAnalysis(data)
    } catch {}
    setAnalyzing(false)
  }

  const handleSaveToNotes = async () => {
    if (!analysis) return
    setSaving(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Document Analysis: ${analysis.filename}`,
          content: analysis.analysis,
          tags: 'document,analysis',
        }),
      })
      if (res.ok) toast.success('Saved to notes')
      else toast.error('Failed to save')
    } catch {
      toast.error('Failed to save')
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#000810' }}>
      <Header title="Document Intelligence" subtitle="Analyze PDFs and text files with AI" />
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex flex-col gap-6">

          {/* Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'relative rounded-xl border-2 border-dashed p-12 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200',
              dragging ? 'border-cyan-400 bg-cyan-400/5' : 'border-white/10 hover:border-white/20 hover:bg-white/2'
            )}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
            />
            <div className={cn('w-14 h-14 rounded-full flex items-center justify-center transition-colors', dragging ? 'bg-cyan-400/20' : 'bg-white/5')}>
              {extracting ? <Loader2 size={24} className="text-cyan-400 animate-spin" /> : <Upload size={24} className={dragging ? 'text-cyan-400' : 'text-white/30'} />}
            </div>
            <div className="text-center">
              <p className="text-white/70 text-sm font-medium">{extracting ? 'Extracting text…' : 'Drop a document here or click to browse'}</p>
              <p className="text-white/30 text-xs mt-1">PDF · TXT · Markdown · CSV — up to 20MB</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              <AlertCircle size={16} />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <AnimatePresence>
            {doc && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Extracted Text */}
                <div className="hud-stat-card rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-cyan-400" />
                      <p className="hud-label text-xs">EXTRACTED TEXT</p>
                    </div>
                    <div className="flex gap-3 text-white/30 text-xs">
                      {doc.pageCount && <span>{doc.pageCount}p</span>}
                      <span>{doc.wordCount.toLocaleString()} words</span>
                    </div>
                  </div>
                  <p className="text-cyan-400/80 text-xs font-medium truncate">{doc.filename}</p>
                  <div className="flex-1 overflow-y-auto max-h-64 pr-1">
                    <pre className="text-white/60 text-xs leading-relaxed whitespace-pre-wrap font-mono">{doc.text.slice(0, 3000)}{doc.text.length > 3000 ? '\n\n[… truncated for display]' : ''}</pre>
                  </div>
                </div>

                {/* Analysis */}
                <div className="hud-stat-card rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain size={14} className="text-violet-400" />
                      <p className="hud-label text-xs">AI ANALYSIS</p>
                    </div>
                    {analysis && (
                      <button onClick={handleSaveToNotes} disabled={saving} className="flex items-center gap-1.5 text-xs text-green-400 border border-green-400/30 rounded-lg px-2.5 py-1 hover:bg-green-400/10 transition-colors disabled:opacity-50">
                        <Save size={11} />
                        {saving ? 'Saving…' : 'Save to Notes'}
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-64">
                    {analyzing ? (
                      <div className="space-y-2 pt-2">
                        {[80, 100, 65, 90, 75].map((w, i) => (
                          <div key={i} className="h-3 bg-white/5 rounded animate-pulse" style={{ width: `${w}%` }} />
                        ))}
                      </div>
                    ) : analysis ? (
                      <div className="text-white/75 text-xs leading-relaxed whitespace-pre-wrap">{analysis.analysis}</div>
                    ) : (
                      <p className="text-white/30 text-xs pt-2">Analysis will appear here…</p>
                    )}
                  </div>

                  {/* Custom instruction */}
                  <div className="flex gap-2 pt-2 border-t border-white/5">
                    <input
                      value={instruction}
                      onChange={e => setInstruction(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAnalyzeCustom()}
                      placeholder="Ask something specific about this document…"
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-cyan-400/50"
                    />
                    <button
                      onClick={handleAnalyzeCustom}
                      disabled={analyzing || !instruction.trim()}
                      className="px-3 py-2 bg-violet-500/20 border border-violet-500/30 text-violet-400 rounded-lg hover:bg-violet-500/30 transition-colors disabled:opacity-40"
                    >
                      {analyzing ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
