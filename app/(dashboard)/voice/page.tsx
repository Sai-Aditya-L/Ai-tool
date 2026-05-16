'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Header } from '@/components/layout/header'
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MessageSquare,
  Settings,
  X,
  Trash2,
  Play,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { speak, stopSpeaking, isVoiceSupported, stripMarkdown, getBestVoice } from '@/lib/voice-engine'

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: number
  userText: string
  nexusText: string
  timestamp: Date
}

// ── Voice-page local storage keys ─────────────────────────────────────────────
const LS_HISTORY = 'nexus-voice-history'
const LS_RATE = 'nexus-voice-rate'
const LS_PITCH = 'nexus-voice-pitch'
const LS_VOICE = 'nexus-voice-name'
const LS_AUTO_READ = 'nexus-voice-autoread'

// ── Constants ─────────────────────────────────────────────────────────────────
const CYAN = '#00e5ff'
const HUD_BG = 'rgba(0,4,12,0.95)'

const EXAMPLE_COMMANDS = [
  "What's on my schedule today?",
  'Create a task: review the codebase',
  'Set a reminder for tomorrow at 9 AM',
  'How am I doing on my goals?',
  'Start a focus session',
  'Read me my emails',
  "What's the weather like?",
  'Give me a morning briefing',
]

// ── Animated voice orb ────────────────────────────────────────────────────────
function VoiceOrb({ active, speaking }: { active: boolean; speaking: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-40 h-40">
      {/* Outer ripple */}
      <AnimatePresence>
        {(active || speaking) && (
          <>
            <motion.div
              key="ripple1"
              className="absolute rounded-full"
              style={{ border: `1px solid ${CYAN}`, inset: 0 }}
              initial={{ scale: 0.9, opacity: 0.5 }}
              animate={{ scale: 1.6, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              key="ripple2"
              className="absolute rounded-full"
              style={{ border: `1px solid ${CYAN}`, inset: 0 }}
              initial={{ scale: 0.9, opacity: 0.3 }}
              animate={{ scale: 2.0, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Idle subtle pulse */}
      {!active && !speaking && (
        <motion.div
          className="absolute rounded-full"
          style={{ background: `rgba(0,229,255,0.05)`, inset: 0 }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Core orb */}
      <motion.div
        className="relative w-28 h-28 rounded-full flex items-center justify-center"
        animate={
          active
            ? { scale: [1, 1.05, 1], boxShadow: [`0 0 30px rgba(0,229,255,0.4)`, `0 0 50px rgba(0,229,255,0.6)`, `0 0 30px rgba(0,229,255,0.4)`] }
            : speaking
            ? { scale: [1, 1.03, 1] }
            : {}
        }
        transition={{ duration: 0.8, repeat: active || speaking ? Infinity : 0, ease: 'easeInOut' }}
        style={{
          background: active
            ? 'radial-gradient(circle, rgba(0,229,255,0.25) 0%, rgba(0,4,12,0.9) 70%)'
            : speaking
            ? 'radial-gradient(circle, rgba(0,229,255,0.18) 0%, rgba(0,4,12,0.9) 70%)'
            : 'radial-gradient(circle, rgba(0,229,255,0.08) 0%, rgba(0,4,12,0.9) 70%)',
          border: `1.5px solid ${active ? 'rgba(0,229,255,0.7)' : speaking ? 'rgba(0,229,255,0.5)' : 'rgba(0,229,255,0.2)'}`,
          boxShadow: active
            ? '0 0 40px rgba(0,229,255,0.3)'
            : '0 0 20px rgba(0,229,255,0.1)',
        }}
      >
        {active ? (
          <Mic size={36} style={{ color: CYAN }} />
        ) : speaking ? (
          <Volume2 size={36} style={{ color: CYAN }} />
        ) : (
          <Mic size={36} style={{ color: 'rgba(0,229,255,0.4)' }} />
        )}
      </motion.div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VoicePage() {
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [supported, setSupported] = useState<{ stt: boolean; tts: boolean } | null>(null)

  // Conversation history
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const historyIdRef = useRef(0)

  // Settings panel
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [speechRate, setSpeechRate] = useState(0.9)
  const [speechPitch, setSpeechPitch] = useState(0.95)
  const [selectedVoice, setSelectedVoice] = useState<string>('')
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [autoRead, setAutoRead] = useState(true)
  const [wakeWordHint, setWakeWordHint] = useState(false)

  const recognitionRef = useRef<(EventTarget & { stop(): void; start(): void }) | null>(null)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check support
    setSupported(isVoiceSupported())

    // Load voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices().filter(v =>
        v.lang.toLowerCase().startsWith('en')
      )
      setAvailableVoices(voices)
    }
    if ('speechSynthesis' in window) {
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }

    // Load localStorage preferences
    const savedRate = localStorage.getItem(LS_RATE)
    const savedPitch = localStorage.getItem(LS_PITCH)
    const savedVoice = localStorage.getItem(LS_VOICE)
    const savedAutoRead = localStorage.getItem(LS_AUTO_READ)
    if (savedRate) setSpeechRate(Number(savedRate))
    if (savedPitch) setSpeechPitch(Number(savedPitch))
    if (savedVoice) setSelectedVoice(savedVoice)
    if (savedAutoRead !== null) setAutoRead(savedAutoRead === 'true')

    // Load history
    try {
      const raw = localStorage.getItem(LS_HISTORY)
      if (raw) {
        const parsed = JSON.parse(raw) as Array<Omit<HistoryEntry, 'timestamp'> & { timestamp: string }>
        const entries: HistoryEntry[] = parsed.map(e => ({ ...e, timestamp: new Date(e.timestamp) }))
        setHistory(entries)
        if (entries.length > 0) historyIdRef.current = Math.max(...entries.map(e => e.id))
      }
    } catch {}

    return () => {
      stopSpeaking()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select best voice if none stored
  useEffect(() => {
    if (!selectedVoice && availableVoices.length > 0) {
      const best = getBestVoice()
      if (best) setSelectedVoice(best.name)
    }
  }, [availableVoices, selectedVoice])

  // Persist settings
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(LS_RATE, String(speechRate))
  }, [speechRate])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(LS_PITCH, String(speechPitch))
  }, [speechPitch])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (selectedVoice) localStorage.setItem(LS_VOICE, selectedVoice)
  }, [selectedVoice])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(LS_AUTO_READ, String(autoRead))
  }, [autoRead])

  // Spacebar push-to-talk
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      if (!isRecording) startRecording()
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      if (isRecording) stopRecording()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [isRecording]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recording ─────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!supported?.stt) {
      toast.error('Speech recognition not supported in this browser.')
      return
    }
    if (isRecording) return

    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new (SpeechRecognition as new () => EventTarget & {
      continuous: boolean
      interimResults: boolean
      lang: string
      start(): void
      stop(): void
      onstart: (() => void) | null
      onend: (() => void) | null
      onerror: ((e: { error: string }) => void) | null
      onresult: ((e: { results: { isFinal: boolean; [n: number]: { transcript: string }[] }[] }) => void) | null
    })()

    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsRecording(true)
    recognition.onend = () => setIsRecording(false)
    recognition.onerror = (e: { error: string }) => {
      setIsRecording(false)
      if (e.error === 'not-allowed') {
        toast.error('Microphone access denied.')
      } else {
        toast.error(`Voice error: ${e.error}`)
      }
    }
    recognition.onresult = (e: { results: { isFinal: boolean; [n: number]: { transcript: string }[] }[] }) => {
      const results = Array.from(e.results as unknown as Array<{ isFinal: boolean; [n: number]: { transcript: string } }>)
      const t = results.map(r => r[0].transcript).join('')
      setTranscript(t)
      const last = results[results.length - 1] as { isFinal: boolean; [n: number]: { transcript: string } }
      if (last.isFinal && t.trim()) {
        sendToNexus(t.trim())
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [supported, isRecording]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }, [])

  // ── API call ──────────────────────────────────────────────────────────────
  const sendToNexus = useCallback(async (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    setResponse('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          voice: true,
        }),
      })

      if (!res.ok) {
        toast.error('NEXUS unavailable')
        return
      }

      // Collect full SSE stream
      const reader = res.body?.getReader()
      let fullText = ''
      if (reader) {
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const delta =
                parsed?.delta?.text ||
                parsed?.choices?.[0]?.delta?.content ||
                parsed?.text ||
                parsed?.content ||
                ''
              if (delta) fullText += delta
            } catch {
              if (data) fullText += data
            }
          }
        }
      }

      // Fallback to JSON body
      if (!fullText.trim()) {
        try {
          const json = await res.clone().json()
          fullText = json.message || json.content || json.text || ''
        } catch {}
      }

      if (!fullText.trim()) {
        toast.error('NEXUS returned no response')
        return
      }

      setResponse(fullText)

      // Persist history
      const entry: HistoryEntry = {
        id: ++historyIdRef.current,
        userText: text,
        nexusText: fullText,
        timestamp: new Date(),
      }
      setHistory(prev => {
        const next = [entry, ...prev].slice(0, 5)
        try {
          localStorage.setItem(LS_HISTORY, JSON.stringify(next))
        } catch {}
        return next
      })

      // Speak
      if (autoRead && supported?.tts) {
        setIsSpeaking(true)
        await speak(fullText, { rate: speechRate, pitch: speechPitch, voice: selectedVoice })
        setIsSpeaking(false)
      }
    } catch {
      toast.error('Voice command failed')
    } finally {
      setLoading(false)
    }
  }, [autoRead, supported, speechRate, speechPitch, selectedVoice])

  const handleTest = useCallback(async () => {
    if (!supported?.tts) {
      toast.error('Text-to-speech not supported in this browser.')
      return
    }
    setIsSpeaking(true)
    await speak('Voice interface active. How can I assist you?', {
      rate: speechRate,
      pitch: speechPitch,
      voice: selectedVoice,
    })
    setIsSpeaking(false)
  }, [supported, speechRate, speechPitch, selectedVoice])

  const clearHistory = () => {
    setHistory([])
    try { localStorage.removeItem(LS_HISTORY) } catch {}
  }

  // ── Status text ───────────────────────────────────────────────────────────
  const statusText = isRecording
    ? 'LISTENING'
    : loading
    ? 'PROCESSING'
    : isSpeaking
    ? 'SPEAKING'
    : 'STANDBY'

  const statusColor = isRecording
    ? '#ef4444'
    : loading
    ? CYAN
    : isSpeaking
    ? CYAN
    : 'rgba(255,255,255,0.25)'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Voice Interface" subtitle="Neural speech command center" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Support warning */}
          {supported && !supported.stt && (
            <div className="glass-panel rounded-xl p-4 border border-yellow-400/20 text-yellow-400/70 text-sm">
              Speech recognition requires Chrome or Edge. Text-to-speech {supported.tts ? 'is' : 'is not'} available.
            </div>
          )}

          {/* ── Top: Orb + status ───────────────────────────────────── */}
          <div
            className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-5"
            style={{ background: HUD_BG, border: '1px solid rgba(0,229,255,0.12)' }}
          >
            <p className="text-xs tracking-[0.3em] uppercase" style={{ color: 'rgba(0,229,255,0.4)' }}>
              VOICE INTERFACE
            </p>

            <VoiceOrb active={isRecording} speaking={isSpeaking} />

            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <motion.div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: statusColor }}
                animate={isRecording || isSpeaking || loading ? { opacity: [1, 0.3, 1] } : {}}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <span
                className="text-xs font-mono tracking-[0.25em]"
                style={{ color: statusColor }}
              >
                {statusText}
              </span>
            </div>

            {/* Push-to-talk button */}
            <div className="flex items-center gap-4">
              <motion.button
                onClick={isRecording ? stopRecording : startRecording}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                disabled={loading || isSpeaking}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-full border text-sm font-medium transition-all',
                  'disabled:opacity-40 disabled:cursor-not-allowed'
                )}
                style={
                  isRecording
                    ? { background: 'rgba(239,68,68,0.15)', border: '1.5px solid rgba(239,68,68,0.6)', color: '#f87171' }
                    : { background: 'rgba(0,229,255,0.08)', border: `1.5px solid rgba(0,229,255,0.3)`, color: CYAN }
                }
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                {isRecording ? 'Stop Recording' : 'Push to Talk'}
              </motion.button>

              {isSpeaking && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => { stopSpeaking(); setIsSpeaking(false) }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs"
                  style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', background: 'rgba(239,68,68,0.08)' }}
                >
                  <VolumeX size={13} />
                  Stop
                </motion.button>
              )}
            </div>

            <p className="text-white/20 text-xs">Hold Space to talk · Ctrl+Shift+V from anywhere</p>
          </div>

          {/* ── Live transcript panel ─────────────────────────────────── */}
          <AnimatePresence>
            {(transcript || response || loading) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="glass-panel rounded-xl p-5 space-y-4"
                style={{ border: '1px solid rgba(0,229,255,0.12)' }}
              >
                <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(0,229,255,0.4)' }}>
                  Live Transcript
                </p>

                {transcript && (
                  <div className="space-y-1">
                    <p className="text-white/30 text-xs">You</p>
                    <p className="text-white/80 text-sm leading-relaxed">{transcript}</p>
                  </div>
                )}

                {loading && !response && (
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="w-4 h-4 rounded-full border-2 border-cyan-400/30 border-t-cyan-400"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    <span className="text-white/30 text-xs">NEXUS is thinking...</span>
                  </div>
                )}

                {response && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.9) 0%, rgba(124,58,237,0.7) 100%)' }}
                      />
                      <p className="text-xs" style={{ color: 'rgba(0,229,255,0.6)' }}>NEXUS</p>
                      {isSpeaking && (
                        <motion.div
                          className="flex items-end gap-0.5 h-3 ml-1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          {[0, 1, 2, 3].map(i => (
                            <motion.div
                              key={i}
                              className="w-0.5 rounded-full"
                              style={{ background: CYAN }}
                              animate={{ height: ['20%', '100%', '20%'] }}
                              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
                            />
                          ))}
                        </motion.div>
                      )}
                    </div>
                    <p className="text-white/80 text-sm leading-relaxed">{response}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Example commands ──────────────────────────────────────── */}
          <div className="glass-panel rounded-xl p-5" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs tracking-widest uppercase mb-4" style={{ color: 'rgba(0,229,255,0.4)' }}>
              Voice Commands
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXAMPLE_COMMANDS.map(cmd => (
                <button
                  key={cmd}
                  onClick={() => {
                    setTranscript(cmd)
                    sendToNexus(cmd)
                  }}
                  disabled={isRecording || loading || isSpeaking}
                  className="text-left flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.55)',
                  }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,229,255,0.2)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.06)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)'
                  }}
                >
                  <MessageSquare size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'rgba(0,229,255,0.4)' }} />
                  {cmd}
                </button>
              ))}
            </div>
          </div>

          {/* ── Voice settings panel ──────────────────────────────────── */}
          <div className="glass-panel rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setSettingsOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-all"
            >
              <div className="flex items-center gap-2">
                <Settings size={14} style={{ color: 'rgba(0,229,255,0.5)' }} />
                <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(0,229,255,0.5)' }}>
                  Voice Settings
                </span>
              </div>
              <motion.div
                animate={{ rotate: settingsOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <X size={13} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </motion.div>
            </button>

            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 space-y-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>

                    {/* Voice selector */}
                    {availableVoices.length > 0 && (
                      <div className="space-y-2 pt-4">
                        <label className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Voice</label>
                        <select
                          value={selectedVoice}
                          onChange={e => setSelectedVoice(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.7)',
                            focusRingColor: CYAN,
                          } as React.CSSProperties}
                        >
                          {availableVoices.map(v => (
                            <option key={v.name} value={v.name} className="bg-gray-900">
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Speed */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        <span>Voice Speed</span>
                        <span style={{ color: CYAN }}>{speechRate.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range" min={0.5} max={2.0} step={0.05}
                        value={speechRate}
                        onChange={e => setSpeechRate(Number(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                      <div className="flex justify-between text-white/15 text-xs">
                        <span>0.5x</span><span>1.0x</span><span>2.0x</span>
                      </div>
                    </div>

                    {/* Pitch */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        <span>Voice Pitch</span>
                        <span style={{ color: CYAN }}>{speechPitch.toFixed(2)}</span>
                      </div>
                      <input
                        type="range" min={0.5} max={2.0} step={0.05}
                        value={speechPitch}
                        onChange={e => setSpeechPitch(Number(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                      <div className="flex justify-between text-white/15 text-xs">
                        <span>0.5</span><span>1.0</span><span>2.0</span>
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="space-y-3 pt-1">
                      {/* Auto-read toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/60 text-sm">Auto-read Responses</p>
                          <p className="text-white/25 text-xs mt-0.5">Speak NEXUS replies aloud automatically</p>
                        </div>
                        <button
                          onClick={() => setAutoRead(a => !a)}
                          className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
                          style={{ background: autoRead ? 'rgba(0,229,255,0.7)' : 'rgba(255,255,255,0.1)' }}
                        >
                          <motion.div
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                            animate={{ left: autoRead ? '22px' : '2px' }}
                            transition={{ duration: 0.18 }}
                          />
                        </button>
                      </div>

                      {/* Wake word toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/60 text-sm">Keyboard Shortcut</p>
                          <p className="text-white/25 text-xs mt-0.5">Use Ctrl+Shift+V from any page</p>
                        </div>
                        <button
                          onClick={() => setWakeWordHint(w => !w)}
                          className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
                          style={{ background: wakeWordHint ? 'rgba(0,229,255,0.7)' : 'rgba(255,255,255,0.1)' }}
                        >
                          <motion.div
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                            animate={{ left: wakeWordHint ? '22px' : '2px' }}
                            transition={{ duration: 0.18 }}
                          />
                        </button>
                      </div>
                      {wakeWordHint && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-lg px-3 py-2 text-xs"
                          style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)', color: 'rgba(255,255,255,0.5)' }}
                        >
                          Press <kbd className="px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.1)', color: CYAN }}>Ctrl+Shift+V</kbd> anywhere in NEXUS to activate voice instantly.
                          The floating voice button at the bottom-left is always available.
                        </motion.div>
                      )}
                    </div>

                    {/* Test button */}
                    <button
                      onClick={handleTest}
                      disabled={isSpeaking || loading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: 'rgba(0,229,255,0.08)',
                        border: `1px solid rgba(0,229,255,0.2)`,
                        color: CYAN,
                      }}
                    >
                      <Play size={12} />
                      Test Voice
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Conversation history ──────────────────────────────────── */}
          {history.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={12} style={{ color: 'rgba(0,229,255,0.4)' }} />
                  <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Recent Exchanges
                  </p>
                </div>
                <button
                  onClick={clearHistory}
                  className="flex items-center gap-1 text-xs transition-colors hover:text-red-400/70"
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  <Trash2 size={11} />
                  Clear
                </button>
              </div>

              <div className="space-y-2">
                {history.map((entry, idx) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'glass-panel rounded-xl p-4 space-y-3 border transition-all',
                      idx === 0 ? '' : 'opacity-60'
                    )}
                    style={{ border: idx === 0 ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.04)' }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="text-xs mt-0.5 uppercase tracking-wider w-10 flex-shrink-0"
                        style={{ color: 'rgba(255,255,255,0.22)' }}
                      >
                        You
                      </span>
                      <p className="text-white/60 text-xs leading-relaxed">{entry.userText}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span
                        className="text-xs mt-0.5 uppercase tracking-wider w-10 flex-shrink-0"
                        style={{ color: 'rgba(0,229,255,0.35)' }}
                      >
                        NXS
                      </span>
                      <p className="text-white/50 text-xs leading-relaxed line-clamp-3">
                        {stripMarkdown(entry.nexusText)}
                      </p>
                    </div>
                    <p className="text-white/15 text-xs text-right">
                      {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
