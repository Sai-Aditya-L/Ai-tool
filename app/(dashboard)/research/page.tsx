'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Search, BookOpen, FileText, GitCompare, AlignLeft, Loader2, Download, Save, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

type ResearchMode = 'search' | 'wiki' | 'document' | 'compare' | 'summarize'

interface SearchResult {
  title: string
  url: string
  snippet: string
}

interface WikiResult {
  title: string
  summary: string
  url: string
  thumbnail?: string
}

const MODES: { id: ResearchMode; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'search', label: 'Web Search', icon: <Search size={14} />, description: 'Search the web for information' },
  { id: 'wiki', label: 'Wikipedia', icon: <BookOpen size={14} />, description: 'Look up Wikipedia articles' },
  { id: 'document', label: 'Document Analysis', icon: <FileText size={14} />, description: 'Analyze pasted text or documents' },
  { id: 'compare', label: 'Compare', icon: <GitCompare size={14} />, description: 'Compare two pieces of content' },
  { id: 'summarize', label: 'Summarize', icon: <AlignLeft size={14} />, description: 'Summarize long text with key points' },
]

export default function ResearchPage() {
  const [mode, setMode] = useState<ResearchMode>('search')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<string | null>(null)
  const [rawSearchResults, setRawSearchResults] = useState<SearchResult[] | null>(null)
  const [wikiResult, setWikiResult] = useState<WikiResult | null>(null)
  const [savingNote, setSavingNote] = useState(false)

  // Input states per mode
  const [searchQuery, setSearchQuery] = useState('')
  const [wikiTopic, setWikiTopic] = useState('')
  const [documentText, setDocumentText] = useState('')
  const [compareA, setCompareA] = useState('')
  const [compareB, setCompareB] = useState('')
  const [summarizeText, setSummarizeText] = useState('')

  async function callAI(prompt: string, systemHint?: string): Promise<string> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        systemHint,
      }),
    })
    if (!res.ok) throw new Error('AI request failed')
    const data = await res.json()
    return data.message || data.content || data.response || JSON.stringify(data)
  }

  async function handleDeploy() {
    setLoading(true)
    setResults(null)
    setRawSearchResults(null)
    setWikiResult(null)

    try {
      if (mode === 'search') {
        if (!searchQuery.trim()) { toast.error('Enter a search query'); return }
        const res = await fetch(`/api/tools/search?q=${encodeURIComponent(searchQuery)}&num=8`)
        if (!res.ok) throw new Error('Search failed')
        const data = await res.json()
        setRawSearchResults(data.results || [])
        setResults('search')
      }

      else if (mode === 'wiki') {
        if (!wikiTopic.trim()) { toast.error('Enter a topic'); return }
        const res = await fetch(`/api/tools/wiki?topic=${encodeURIComponent(wikiTopic)}`)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Wikipedia lookup failed')
        }
        const data = await res.json()
        setWikiResult(data)
        setResults('wiki')
      }

      else if (mode === 'document') {
        if (!documentText.trim()) { toast.error('Paste text to analyze'); return }
        const analysis = await callAI(
          `Analyze this document and provide:\n1. A brief summary\n2. Key themes and topics\n3. Important insights or findings\n4. Any notable claims or data points\n\nDocument:\n${documentText.slice(0, 8000)}`
        )
        setResults(analysis)
      }

      else if (mode === 'compare') {
        if (!compareA.trim() || !compareB.trim()) { toast.error('Fill in both text areas to compare'); return }
        const comparison = await callAI(
          `Compare and contrast these two pieces of content:\n\n--- Content A ---\n${compareA.slice(0, 4000)}\n\n--- Content B ---\n${compareB.slice(0, 4000)}\n\nProvide:\n1. Key similarities\n2. Key differences\n3. Strengths of each\n4. Overall assessment`
        )
        setResults(comparison)
      }

      else if (mode === 'summarize') {
        if (!summarizeText.trim()) { toast.error('Paste text to summarize'); return }
        const summary = await callAI(
          `Summarize this text concisely. Provide:\n1. A 2-3 sentence executive summary\n2. Key points (bullet list)\n3. Main takeaways\n\nText:\n${summarizeText.slice(0, 8000)}`
        )
        setResults(summary)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Research failed')
    } finally {
      setLoading(false)
    }
  }

  async function saveToNotes() {
    if (!results) return
    setSavingNote(true)
    try {
      const currentMode = MODES.find(m => m.id === mode)
      let title = `Research: ${currentMode?.label}`
      let content = ''

      if (mode === 'search' && rawSearchResults) {
        title = `Web Search: ${searchQuery}`
        content = rawSearchResults.map((r, i) => `${i + 1}. **${r.title}**\n${r.url}\n${r.snippet}`).join('\n\n')
      } else if (mode === 'wiki' && wikiResult) {
        title = `Wikipedia: ${wikiResult.title}`
        content = `${wikiResult.summary}\n\nSource: ${wikiResult.url}`
      } else {
        content = results as string
      }

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, tags: 'research' }),
      })
      if (!res.ok) throw new Error('Failed to save note')
      toast.success('Saved to Notes')
    } catch {
      toast.error('Failed to save to Notes')
    } finally {
      setSavingNote(false)
    }
  }

  function exportResults() {
    let text = ''
    if (mode === 'search' && rawSearchResults) {
      text = `Web Search: ${searchQuery}\n\n` +
        rawSearchResults.map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n')
    } else if (mode === 'wiki' && wikiResult) {
      text = `Wikipedia: ${wikiResult.title}\n\n${wikiResult.summary}\n\nSource: ${wikiResult.url}`
    } else if (results) {
      text = results
    }
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexus-research-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasResults = results !== null

  return (
    <div className="flex flex-col h-full min-h-0">
      <Header title="RESEARCH" subtitle="Oracle research workspace — deep analysis & synthesis" />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel: controls */}
        <div className="w-[340px] flex-shrink-0 border-r border-cyan-400/10 flex flex-col overflow-y-auto p-4 gap-4" style={{ background: '#00060f' }}>
          {/* Mode tabs */}
          <div>
            <div className="text-[10px] text-white/30 nexus-mono tracking-widest mb-2">RESEARCH MODE</div>
            <div className="space-y-1">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setMode(m.id); setResults(null); setRawSearchResults(null); setWikiResult(null) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                    mode === m.id
                      ? 'border-cyan-400/40 bg-cyan-400/8 text-cyan-400'
                      : 'border-transparent text-white/50 hover:text-white/80 hover:bg-white/3 hover:border-white/10'
                  }`}
                >
                  <span className={mode === m.id ? 'text-cyan-400' : 'text-white/30'}>{m.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium nexus-mono">{m.label}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">{m.description}</div>
                  </div>
                  {mode === m.id && <ChevronRight size={12} className="ml-auto flex-shrink-0 text-cyan-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Mode-specific inputs */}
          <div className="flex-1">
            <div className="text-[10px] text-white/30 nexus-mono tracking-widest mb-2">INPUT</div>

            {mode === 'search' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDeploy()}
                  placeholder="Enter search query..."
                  className="w-full px-3 py-2.5 rounded-lg border border-cyan-400/20 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors"
                />
              </div>
            )}

            {mode === 'wiki' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={wikiTopic}
                  onChange={e => setWikiTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDeploy()}
                  placeholder="Enter Wikipedia topic..."
                  className="w-full px-3 py-2.5 rounded-lg border border-cyan-400/20 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors"
                />
              </div>
            )}

            {mode === 'document' && (
              <textarea
                value={documentText}
                onChange={e => setDocumentText(e.target.value)}
                placeholder="Paste document text here for AI analysis..."
                rows={10}
                className="w-full px-3 py-2.5 rounded-lg border border-cyan-400/20 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors resize-none"
              />
            )}

            {mode === 'compare' && (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-white/30 nexus-mono mb-1">Content A</div>
                  <textarea
                    value={compareA}
                    onChange={e => setCompareA(e.target.value)}
                    placeholder="First piece of content..."
                    rows={5}
                    className="w-full px-3 py-2.5 rounded-lg border border-cyan-400/20 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors resize-none"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-white/30 nexus-mono mb-1">Content B</div>
                  <textarea
                    value={compareB}
                    onChange={e => setCompareB(e.target.value)}
                    placeholder="Second piece of content..."
                    rows={5}
                    className="w-full px-3 py-2.5 rounded-lg border border-cyan-400/20 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors resize-none"
                  />
                </div>
              </div>
            )}

            {mode === 'summarize' && (
              <textarea
                value={summarizeText}
                onChange={e => setSummarizeText(e.target.value)}
                placeholder="Paste long text to summarize..."
                rows={10}
                className="w-full px-3 py-2.5 rounded-lg border border-cyan-400/20 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors resize-none"
              />
            )}
          </div>

          {/* Deploy button */}
          <button
            onClick={handleDeploy}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cyan-400 text-black font-semibold text-sm nexus-mono hover:bg-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Oracle is researching...
              </>
            ) : (
              <>
                <Search size={14} />
                Deploy Oracle
              </>
            )}
          </button>
        </div>

        {/* Right panel: results */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Results toolbar */}
          {hasResults && (
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-cyan-400/10 bg-black/20 flex-shrink-0">
              <span className="text-xs text-white/40 nexus-mono mr-auto">Research Results</span>
              <button
                onClick={saveToNotes}
                disabled={savingNote}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-400/20 text-cyan-400/70 hover:text-cyan-400 hover:border-cyan-400/40 text-xs nexus-mono transition-all disabled:opacity-40"
              >
                <Save size={11} />
                {savingNote ? 'Saving...' : 'Save to Notes'}
              </button>
              <button
                onClick={exportResults}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 text-xs nexus-mono transition-all"
              >
                <Download size={11} />
                Export
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-6">
            {!hasResults && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full border border-cyan-400/15 flex items-center justify-center mb-4 bg-cyan-400/3">
                  <Search size={24} className="text-cyan-400/30" />
                </div>
                <p className="text-white/30 text-sm nexus-mono">Select a research mode and deploy the Oracle</p>
                <p className="text-white/15 text-xs nexus-mono mt-1">Results will appear here</p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-10 h-10 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mb-4" />
                <p className="text-cyan-400/60 text-sm nexus-mono">Oracle is researching...</p>
              </div>
            )}

            {/* Web Search Results */}
            {!loading && results === 'search' && rawSearchResults && (
              <div className="space-y-4">
                <div className="text-xs text-white/40 nexus-mono mb-4">
                  {rawSearchResults.length} results for "{searchQuery}"
                </div>
                {rawSearchResults.map((r, i) => (
                  <div key={i} className="rounded-xl border border-white/8 bg-white/2 p-4 hover:border-cyan-400/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center bg-cyan-400/10 text-cyan-400 text-[10px] nexus-mono font-bold mt-0.5">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors line-clamp-1 block"
                        >
                          {r.title}
                        </a>
                        <div className="text-[10px] text-white/30 nexus-mono mt-0.5 line-clamp-1">{r.url}</div>
                        <p className="text-sm text-white/55 mt-1.5 leading-relaxed">{r.snippet}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Wikipedia Result */}
            {!loading && results === 'wiki' && wikiResult && (
              <div className="rounded-xl border border-violet-400/20 bg-violet-400/3 p-6">
                <div className="flex items-start gap-4 mb-4">
                  {wikiResult.thumbnail && (
                    <img src={wikiResult.thumbnail} alt={wikiResult.title} className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-1">{wikiResult.title}</h2>
                    <a
                      href={wikiResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-400 hover:text-violet-300 nexus-mono transition-colors"
                    >
                      View on Wikipedia →
                    </a>
                  </div>
                </div>
                <p className="text-sm text-white/70 leading-relaxed">{wikiResult.summary}</p>
              </div>
            )}

            {/* AI Results (document/compare/summarize) */}
            {!loading && results && results !== 'search' && results !== 'wiki' && (
              <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/2 p-6">
                <div className="text-xs text-cyan-400/50 nexus-mono mb-3 pb-2 border-b border-cyan-400/10">
                  ORACLE ANALYSIS — {MODES.find(m => m.id === mode)?.label?.toUpperCase()}
                </div>
                <div className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{results}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
