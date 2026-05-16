'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Mic, MicOff, Square, Play, Trash2, FileText, Loader2, Copy, Check, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

interface TranscriptLine {
  text: string
  final: boolean
  timestamp: number
}

export default function TranscribePage() {
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [listening, setListening] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [notes, setNotes] = useState('')
  const [title, setTitle] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [supported, setSupported] = useState(true)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const recogRef = useRef<any>(null)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setSupported(false); return }
  }, [])

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const recog = new SR()
    recog.continuous = true
    recog.interimResults = true
    recog.lang = 'en-US'
    recogRef.current = recog

    recog.onresult = (e: any) => {
      let interim = ''
      const finals: string[] = []
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finals.push(e.results[i][0].transcript)
        else interim = e.results[i][0].transcript
      }
      setLines(prev => {
        const next = prev.filter(l => l.final)
        finals.forEach(t => next.push({ text: t.trim(), final: true, timestamp: Date.now() }))
        if (interim) next.push({ text: interim, final: false, timestamp: Date.now() })
        return next
      })
    }

    recog.onerror = (e: any) => {
      if (e.error !== 'no-speech') toast.error(`Mic error: ${e.error}`)
    }

    recog.onend = () => {
      if (listening) recog.start() // auto-restart for continuous recording
    }

    recog.start()
    setListening(true)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000)
  }, [listening])

  const stopListening = useCallback(() => {
    recogRef.current?.stop()
    recogRef.current = null
    setListening(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => {
    recogRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  const fullTranscript = lines.filter(l => l.final).map(l => l.text).join(' ')

  const analyze = async () => {
    if (!fullTranscript.trim()) return toast.error('No transcript to analyze')
    setAnalyzing(true)
    try {
      const res = await fetch('/api/meetings/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: fullTranscript, title: title || undefined, duration: Math.round(elapsed / 60) }),
      })
      const data = await res.json()
      if (res.ok) { setNotes(data.notes); toast.success('Analysis complete') }
      else toast.error(data.error || 'Analysis failed')
    } catch { toast.error('Analysis failed') }
    setAnalyzing(false)
  }

  const copyTranscript = () => {
    navigator.clipboard.writeText(fullTranscript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveNotes = async () => {
    if (!notes) return
    setSaving(true)
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Meeting Notes: ${title || new Date().toLocaleDateString()}`, content: notes, tags: 'meeting,transcript' }),
      })
      toast.success('Saved to notes')
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#000810' }}>
      <Header title="Live Transcription" subtitle="Real-time speech-to-text with AI meeting notes" />
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex flex-col gap-4">

          {!supported && (
            <div className="bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-red-400 text-sm">
              Speech recognition is not supported in this browser. Please use Chrome or Edge.
            </div>
          )}

          {/* Controls */}
          <div className="hud-stat-card rounded-xl p-4 flex flex-wrap items-center gap-4">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Meeting title (optional)"
              className="flex-1 min-w-48 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-cyan-400/50"
            />
            <div className="flex items-center gap-2 ml-auto">
              {listening && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-red-400 font-mono text-sm">{fmt(elapsed)}</span>
                </div>
              )}
              <button
                onClick={listening ? stopListening : startListening}
                disabled={!supported}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40',
                  listening
                    ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                    : 'bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20'
                )}
              >
                {listening ? <><Square size={14} /> Stop</> : <><Mic size={14} /> Start Recording</>}
              </button>
              <button
                onClick={analyze}
                disabled={analyzing || !fullTranscript.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-violet-400/30 text-violet-400 hover:bg-violet-400/10 transition-colors disabled:opacity-40"
              >
                {analyzing ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Analyze
              </button>
              <button onClick={() => setLines([])} className="text-white/20 hover:text-red-400 transition-colors p-2">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
            {/* Transcript */}
            <div className="hud-stat-card rounded-xl p-4 flex flex-col" style={{ minHeight: 400 }}>
              <div className="flex items-center justify-between mb-3">
                <p className="hud-label text-xs">LIVE TRANSCRIPT</p>
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-xs">{fullTranscript.split(/\s+/).filter(Boolean).length} words</span>
                  <button onClick={copyTranscript} className="text-white/20 hover:text-cyan-400 transition-colors">
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                <AnimatePresence initial={false}>
                  {lines.map((line, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn('text-sm leading-relaxed', line.final ? 'text-white/80' : 'text-white/30 italic')}
                    >
                      {line.text}
                    </motion.p>
                  ))}
                </AnimatePresence>
                {lines.length === 0 && (
                  <p className="text-white/20 text-sm">Start recording to see transcript…</p>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* AI Notes */}
            <div className="hud-stat-card rounded-xl p-4 flex flex-col" style={{ minHeight: 400 }}>
              <div className="flex items-center justify-between mb-3">
                <p className="hud-label text-xs">AI MEETING NOTES</p>
                {notes && (
                  <button onClick={saveNotes} disabled={saving} className="flex items-center gap-1.5 text-xs text-green-400 border border-green-400/30 rounded-lg px-2.5 py-1 hover:bg-green-400/10 transition-colors disabled:opacity-50">
                    <Save size={11} />
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {analyzing ? (
                  <div className="space-y-2 pt-2">
                    {[90,70,80,60,75,85].map((w,i) => <div key={i} className="h-3 bg-white/5 rounded animate-pulse" style={{ width: `${w}%` }} />)}
                  </div>
                ) : notes ? (
                  <div className="text-white/75 text-xs leading-relaxed whitespace-pre-wrap">{notes}</div>
                ) : (
                  <p className="text-white/20 text-sm">AI notes will appear here after analysis…</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
