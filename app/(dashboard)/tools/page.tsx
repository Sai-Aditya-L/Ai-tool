'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import {
  QrCode, Youtube, Download, Copy, Check, Loader2, ExternalLink,
  Languages, BookOpen, CloudSun, Search, FileText, Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function saveAsNote(title: string, content: string) {
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  })
  if (!res.ok) throw new Error('Failed to save')
}

// ─── Tool Card Wrapper ────────────────────────────────────────────────────────

function ToolCard({ icon, title, subtitle, accentColor, children }: {
  icon: React.ReactNode
  title: string
  subtitle: string
  accentColor: string
  children: React.ReactNode
}) {
  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        <div>
          <h2 className="text-white font-semibold text-sm tracking-wide">{title}</h2>
          <p className="text-white/40 text-xs">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── QR Code ─────────────────────────────────────────────────────────────────

function QRTool() {
  const [text, setText] = useState('')
  const [size, setSize] = useState(300)
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    if (!text.trim()) { toast.error('Enter text or URL first'); return }
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/tools/qr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, size, darkColor: '#00e5ff', lightColor: '#000810' }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setResult(data.dataUrl)
    } catch { toast.error('QR generation failed') }
    setLoading(false)
  }

  function download() {
    if (!result) return
    const a = document.createElement('a'); a.href = result; a.download = 'nexus-qr.png'; a.click()
  }

  async function copy() {
    if (!result) return
    try {
      const blob = await fetch(result).then(r => r.blob())
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      toast.success('QR copied!')
    } catch { toast.error('Copy not supported in this browser') }
  }

  return (
    <ToolCard icon={<QrCode size={18} />} title="QR Code Generator" subtitle="Convert text or URL to QR code" accentColor="#00e5ff">
      <div className="space-y-3">
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="https://example.com or any text…"
          className="nexus-input resize-none h-20 text-sm w-full"
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) generate() }} />
        <div>
          <label className="text-white/40 text-xs mb-1 block">Size: {size}px</label>
          <input type="range" min={150} max={600} step={50} value={size} onChange={e => setSize(+e.target.value)} className="w-full accent-cyan-400" />
        </div>
        <button onClick={generate} disabled={loading || !text.trim()} className="nexus-btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
          {loading ? 'Generating…' : 'Generate QR'}
        </button>
        {result && (
          <div className="flex flex-col items-center gap-3 pt-1">
            <div className="p-3 rounded-xl border border-cyan-400/20 bg-black/40">
              <img src={result} alt="QR" className="rounded-lg" style={{ width: Math.min(size, 220) }} />
            </div>
            <div className="flex gap-2">
              <button onClick={download} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-xs hover:bg-cyan-400/20 transition-all">
                <Download size={12} /> Download
              </button>
              <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 transition-all">
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </ToolCard>
  )
}

// ─── YouTube Summarizer ───────────────────────────────────────────────────────

function YouTubeTool() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState<{ summary: string; metadata: { durationMinutes: number; wordCount: number }; url: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function summarize() {
    if (!url.trim()) { toast.error('Enter a YouTube URL'); return }
    setLoading(true); setResult(null); setError('')
    try {
      const res = await fetch('/api/tools/youtube', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResult(data)
    } catch { setError('Failed to process video') }
    setLoading(false)
  }

  async function save() {
    if (!result) return
    setSaving(true)
    try { await saveAsNote(`YouTube Summary: ${url}`, result.summary); toast.success('Saved to notes!') }
    catch { toast.error('Failed to save') }
    setSaving(false)
  }

  return (
    <ToolCard icon={<Youtube size={18} />} title="YouTube Summarizer" subtitle="AI summaries of any YouTube video" accentColor="#f87171">
      <div className="space-y-3">
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…"
          className="nexus-input text-sm w-full" onKeyDown={e => { if (e.key === 'Enter') summarize() }} />
        <button onClick={summarize} disabled={loading || !url.trim()}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all border"
          style={{ background: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Youtube size={14} />}
          {loading ? 'Analyzing…' : 'Summarize'}
        </button>
        {error && <p className="text-red-400 text-xs p-2 bg-red-400/8 rounded-lg border border-red-400/20">{error}</p>}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-white/35">
              <span>{result.metadata.durationMinutes}m video · {result.metadata.wordCount.toLocaleString()} words</span>
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-red-400/60 hover:text-red-400">
                <ExternalLink size={10} /> Watch
              </a>
            </div>
            <div className="p-3 rounded-lg bg-white/3 border border-white/8 max-h-48 overflow-y-auto text-white/70 text-xs leading-relaxed whitespace-pre-wrap">{result.summary}</div>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(result!.summary).then(() => toast.success('Copied!'))} className="flex items-center gap-1 text-xs text-white/35 hover:text-white/60 transition-colors">
                <Copy size={11} /> Copy
              </button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1 text-xs text-white/35 hover:text-cyan-400 transition-colors">
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save Note
              </button>
            </div>
          </div>
        )}
      </div>
    </ToolCard>
  )
}

// ─── Translator ───────────────────────────────────────────────────────────────

const LANGUAGES = ['Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Japanese', 'Korean', 'Chinese', 'Arabic', 'Hindi', 'Russian', 'Dutch', 'Polish', 'Turkish', 'Swedish']

function TranslateTool() {
  const [text, setText] = useState('')
  const [lang, setLang] = useState('Spanish')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function translate() {
    if (!text.trim()) { toast.error('Enter text to translate'); return }
    setLoading(true); setResult('')
    try {
      const res = await fetch('/api/tools/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage: lang }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setResult(data.translated)
    } catch { toast.error('Translation failed') }
    setLoading(false)
  }

  function copy() {
    navigator.clipboard.writeText(result)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    toast.success('Copied!')
  }

  return (
    <ToolCard icon={<Languages size={18} />} title="Translator" subtitle="Translate text into any language" accentColor="#a78bfa">
      <div className="space-y-3">
        <select value={lang} onChange={e => setLang(e.target.value)} className="nexus-input w-full text-sm">
          {LANGUAGES.map(l => <option key={l}>{l}</option>)}
        </select>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Text to translate…"
          className="nexus-input resize-none h-24 text-sm w-full" />
        <button onClick={translate} disabled={loading || !text.trim()}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-all"
          style={{ background: 'rgba(167,139,250,0.1)', borderColor: 'rgba(167,139,250,0.3)', color: '#a78bfa' }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
          {loading ? 'Translating…' : `Translate to ${lang}`}
        </button>
        {result && (
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-white/3 border border-white/8 text-white/70 text-sm leading-relaxed">{result}</div>
            <button onClick={copy} className="flex items-center gap-1 text-xs text-white/35 hover:text-white/60 transition-colors">
              {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />} {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </ToolCard>
  )
}

// ─── Wikipedia ────────────────────────────────────────────────────────────────

function WikiTool() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{ title: string; summary: string; url: string; thumbnail?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function search() {
    if (!query.trim()) { toast.error('Enter a topic'); return }
    setLoading(true); setResult(null)
    try {
      const res = await fetch(`/api/tools/wiki?topic=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setResult(data)
    } catch { toast.error('Wikipedia lookup failed') }
    setLoading(false)
  }

  async function save() {
    if (!result) return
    setSaving(true)
    try { await saveAsNote(`Wikipedia: ${result.title}`, result.summary); toast.success('Saved to notes!') }
    catch { toast.error('Failed to save') }
    setSaving(false)
  }

  return (
    <ToolCard icon={<BookOpen size={18} />} title="Wikipedia Lookup" subtitle="Quick facts from Wikipedia" accentColor="#34d399">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Wikipedia…"
            className="nexus-input flex-1 text-sm" onKeyDown={e => { if (e.key === 'Enter') search() }} />
          <button onClick={search} disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 text-sm hover:bg-emerald-400/20 transition-all disabled:opacity-40">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          </button>
        </div>
        {result && (
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              {result.thumbnail && <img src={result.thumbnail} alt={result.title} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <h3 className="text-white/85 font-medium text-sm">{result.title}</h3>
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-emerald-400/60 text-xs hover:text-emerald-400 flex items-center gap-1">
                  <ExternalLink size={9} /> Wikipedia
                </a>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-white/3 border border-white/8 text-white/65 text-xs leading-relaxed max-h-36 overflow-y-auto">{result.summary}</div>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(result!.summary).then(() => toast.success('Copied!'))} className="flex items-center gap-1 text-xs text-white/35 hover:text-white/60 transition-colors">
                <Copy size={11} /> Copy
              </button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1 text-xs text-white/35 hover:text-cyan-400 transition-colors">
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save Note
              </button>
            </div>
          </div>
        )}
      </div>
    </ToolCard>
  )
}

// ─── Weather ──────────────────────────────────────────────────────────────────

function WeatherTool() {
  const [city, setCity] = useState('')
  const [result, setResult] = useState<{ city: string; country: string; current: { temp: number; weatherLabel: string; icon: string }; forecast: Array<{ date: string; maxTemp: number; minTemp: number; weatherLabel: string; precipSum: number }> } | null>(null)
  const [loading, setLoading] = useState(false)

  async function lookup() {
    if (!city.trim()) { toast.error('Enter a city name'); return }
    setLoading(true); setResult(null)
    try {
      const res = await fetch(`/api/tools/weather-tool?city=${encodeURIComponent(city)}`)
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setResult(data)
    } catch { toast.error('Weather lookup failed') }
    setLoading(false)
  }

  return (
    <ToolCard icon={<CloudSun size={18} />} title="Weather Lookup" subtitle="Current weather and 7-day forecast" accentColor="#fbbf24">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="City name…"
            className="nexus-input flex-1 text-sm" onKeyDown={e => { if (e.key === 'Enter') lookup() }} />
          <button onClick={lookup} disabled={loading || !city.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-400 text-sm hover:bg-amber-400/20 transition-all disabled:opacity-40">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <CloudSun size={13} />}
          </button>
        </div>
        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-400/5 border border-amber-400/15">
              <span className="text-3xl">{result.current.icon}</span>
              <div>
                <p className="text-white/85 font-medium">{result.city}, {result.country}</p>
                <p className="text-amber-400 text-2xl font-bold">{result.current.temp}°C</p>
                <p className="text-white/40 text-xs">{result.current.weatherLabel}</p>
              </div>
            </div>
            {result.forecast?.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5">
                {result.forecast.slice(0, 4).map(d => (
                  <div key={d.date} className="text-center p-2 rounded-lg bg-white/3 border border-white/6">
                    <p className="text-white/35 text-[10px]">{new Date(d.date + 'T12:00').toLocaleDateString('en', { weekday: 'short' })}</p>
                    <p className="text-white/70 text-sm font-medium">{d.maxTemp}°</p>
                    <p className="text-white/30 text-[10px]">{d.minTemp}°</p>
                    <p className="text-blue-400/60 text-[9px]">{d.precipSum}mm</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ToolCard>
  )
}

// ─── Web Search ───────────────────────────────────────────────────────────────

function WebSearchTool() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ title: string; url: string; snippet: string }>>([])
  const [loading, setLoading] = useState(false)

  async function search() {
    if (!query.trim()) { toast.error('Enter a search query'); return }
    setLoading(true); setResults([])
    try {
      const res = await fetch(`/api/tools/search?q=${encodeURIComponent(query)}&num=6`)
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setResults(data.results ?? [])
      if (!data.results?.length) toast('No results found', { icon: '🔍' })
    } catch { toast.error('Search failed') }
    setLoading(false)
  }

  return (
    <ToolCard icon={<Search size={18} />} title="Web Search" subtitle="Search the web for any topic" accentColor="#60a5fa">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the web…"
            className="nexus-input flex-1 text-sm" onKeyDown={e => { if (e.key === 'Enter') search() }} />
          <button onClick={search} disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-400/30 bg-blue-400/10 text-blue-400 text-sm hover:bg-blue-400/20 transition-all disabled:opacity-40">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          </button>
        </div>
        {results.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {results.map((r, i) => (
              <div key={i} className="p-3 rounded-lg bg-white/3 border border-white/8 hover:border-blue-400/20 transition-all">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-400/80 text-xs font-medium hover:text-blue-400 line-clamp-1">{r.title}</a>
                <p className="text-white/40 text-[10px] truncate mt-0.5">{r.url}</p>
                <p className="text-white/55 text-xs mt-1 line-clamp-2">{r.snippet}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolCard>
  )
}

// ─── PDF Reader ───────────────────────────────────────────────────────────────

function PDFTool() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ text: string; pageCount?: number; wordCount: number } | null>(null)
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) { toast.error('Please select a PDF file'); return }
    setLoading(true); setResult(null); setError('')
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await fetch('/api/tools/pdf', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Extraction failed'); return }
      setResult(data)
    } catch { setError('Failed to extract PDF') }
    setLoading(false)
  }

  return (
    <ToolCard icon={<FileText size={18} />} title="PDF Reader" subtitle="Extract text from PDF files" accentColor="#f97316">
      <div className="space-y-3">
        <label className={cn(
          'flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed cursor-pointer transition-all',
          loading ? 'border-orange-400/30 bg-orange-400/5' : 'border-white/10 hover:border-orange-400/30 hover:bg-orange-400/3'
        )}>
          <FileText size={24} className="text-white/20 mb-1" />
          <span className="text-white/35 text-xs">{loading ? 'Extracting…' : 'Drop PDF or click to upload'}</span>
          <input type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} disabled={loading} />
        </label>
        {loading && <div className="flex items-center gap-2 text-orange-400 text-sm"><Loader2 size={14} className="animate-spin" /> Reading PDF…</div>}
        {error && <p className="text-red-400 text-xs p-2 bg-red-400/8 rounded-lg">{error}</p>}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs text-white/35">
              {result.pageCount && <span>{result.pageCount} pages</span>}
              <span>{result.wordCount.toLocaleString()} words</span>
            </div>
            <div className="p-3 rounded-lg bg-white/3 border border-white/8 text-white/65 text-xs leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">{result.text}</div>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(result!.text).then(() => toast.success('Copied!'))} className="flex items-center gap-1 text-xs text-white/35 hover:text-white/60 transition-colors">
                <Copy size={11} /> Copy Text
              </button>
              <button onClick={async () => {
                try { await saveAsNote('PDF Extract', result!.text.slice(0, 5000)); toast.success('Saved to notes!') }
                catch { toast.error('Failed to save') }
              }} className="flex items-center gap-1 text-xs text-white/35 hover:text-cyan-400 transition-colors">
                <Save size={11} /> Save Note
              </button>
            </div>
          </div>
        )}
      </div>
    </ToolCard>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ToolsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Tools" subtitle="Utility tools powered by NEXUS" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5">
          <QRTool />
          <YouTubeTool />
          <TranslateTool />
          <WikiTool />
          <WeatherTool />
          <WebSearchTool />
          <PDFTool />
        </div>
      </div>
    </div>
  )
}
