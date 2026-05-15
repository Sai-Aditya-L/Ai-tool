'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Mic, MicOff, Volume2, MessageSquare, Settings, X, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface HistoryEntry {
  id: number
  userText: string
  nexusText: string
  timestamp: Date
}

export default function VoicePage() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<any>(null)

  // Conversation history
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const historyIdRef = useRef(0)

  // Settings panel
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [speechRate, setSpeechRate] = useState(0.95)
  const [speechPitch, setSpeechPitch] = useState(1.0)
  const [selectedVoice, setSelectedVoice] = useState<string>('')
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])

  // Auto-read toggle
  const [autoRead, setAutoRead] = useState(true)

  // Wake-word mode
  const [wakeWordMode, setWakeWordMode] = useState(false)
  const [wakeWordActive, setWakeWordActive] = useState(false)
  const wakeWordRef = useRef<any>(null)
  const WAKE_WORDS = ['nexus', 'hey nexus', 'ok nexus']

  // Keyboard shortcut tracking
  const spaceHeldRef = useRef(false)

  // Deterministic waveform bar heights via sine wave
  const waveformHeights = useMemo(
    () => Array.from({ length: 20 }, (_, i) => Math.sin(i * 0.5) * 40 + 60),
    []
  )

  // Detect speech recognition support and load voices
  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
    }

    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices().filter(v =>
          v.lang.toLowerCase().startsWith('en')
        )
        setAvailableVoices(voices)
        if (voices.length > 0 && !selectedVoice) {
          setSelectedVoice(voices[0].name)
        }
      }
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Spacebar push-to-talk
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      // Ignore if focus is in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (spaceHeldRef.current) return
      e.preventDefault()
      spaceHeldRef.current = true
      startRecording()
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      if (!spaceHeldRef.current) return
      e.preventDefault()
      spaceHeldRef.current = false
      stopRecording()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [supported]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup wake-word listener on unmount — use ref to avoid forward-reference error
  useEffect(() => {
    return () => {
      try { wakeWordRef.current?.stop() } catch {}
      wakeWordRef.current = null
    }
  }, [])

  function startRecording() {
    if (!supported) {
      toast.error('Speech recognition not supported in this browser. Use Chrome or Edge.')
      return
    }
    if (isRecording) return

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsRecording(true)
    recognition.onend = () => setIsRecording(false)
    recognition.onerror = (e: any) => {
      setIsRecording(false)
      toast.error(`Voice recognition error: ${e.error}`)
    }
    recognition.onresult = (e: any) => {
      const t = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join('')
      setTranscript(t)
      if (e.results[e.results.length - 1].isFinal) {
        sendToNexus(t)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }

  const startWakeWordListening = useCallback(() => {
    if (typeof window === 'undefined') return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const wr = new SpeechRecognition()
    wr.continuous = true
    wr.interimResults = true
    wr.lang = 'en-US'
    wakeWordRef.current = wr

    wr.onresult = (event: any) => {
      const last = event.results[event.results.length - 1]
      const text = last[0].transcript.toLowerCase().trim()
      const detected = WAKE_WORDS.some(w => text.includes(w))
      if (detected) {
        setWakeWordActive(false)
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance('Yes?')
            utterance.rate = 1.1
            window.speechSynthesis.speak(utterance)
          }
          startRecording()
        }, 400)
      }
    }

    wr.onerror = () => {
      if (wakeWordRef.current) {
        setTimeout(() => { try { wr.start() } catch {} }, 1000)
      }
    }

    wr.onend = () => {
      if (wakeWordRef.current) {
        setTimeout(() => { try { wr.start() } catch {} }, 500)
      }
    }

    try { wr.start() } catch {}
    setWakeWordActive(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stopWakeWordListening = useCallback(() => {
    try { wakeWordRef.current?.stop() } catch {}
    wakeWordRef.current = null
    setWakeWordActive(false)
  }, [])

  const toggleWakeWordMode = () => {
    if (wakeWordMode) {
      stopWakeWordListening()
      setWakeWordMode(false)
    } else {
      setWakeWordMode(true)
      startWakeWordListening()
    }
  }

  async function sendToNexus(text: string) {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
        }),
      })
      const data = await res.json()
      const nexusText: string = data.message || ''
      setResponse(nexusText)

      // Persist to history
      if (text.trim() && nexusText.trim()) {
        const entry: HistoryEntry = {
          id: ++historyIdRef.current,
          userText: text.trim(),
          nexusText: nexusText.trim(),
          timestamp: new Date(),
        }
        setHistory(prev => [entry, ...prev].slice(0, 5))
      }

      // Text-to-speech
      if (autoRead && 'speechSynthesis' in window && nexusText) {
        const clean = nexusText
          .replace(/\*\*?(.*?)\*\*?/g, '$1')
          .replace(/[#•]/g, '')
        const utterance = new SpeechSynthesisUtterance(clean)
        utterance.rate = speechRate
        utterance.pitch = speechPitch
        if (selectedVoice) {
          const voice = window.speechSynthesis
            .getVoices()
            .find(v => v.name === selectedVoice)
          if (voice) utterance.voice = voice
        }
        window.speechSynthesis.speak(utterance)
      }
    } catch {
      toast.error('Voice command failed')
    } finally {
      setLoading(false)
    }
  }

  const EXAMPLE_COMMANDS = [
    'What tasks are due today?',
    'Create a reminder for my meeting tomorrow at 2 PM',
    'Summarize my day',
    'Add a note about the project architecture',
    'Set a high priority task: review the codebase',
    'What are my upcoming reminders?',
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Voice Center" subtitle="Push-to-talk neural interface" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {!supported && (
            <div className="glass-panel rounded-xl p-4 border border-yellow-400/20 text-yellow-400/70 text-sm">
              ⚠ Speech recognition requires Chrome, Edge, or Safari. Current browser not supported.
            </div>
          )}

          {/* Main orb */}
          <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-6">

            {/* Top row: settings toggle + auto-read */}
            <div className="w-full flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRead}
                  onChange={e => setAutoRead(e.target.checked)}
                  className="accent-cyan-400 w-4 h-4"
                />
                <span className="text-white/50 text-xs">Auto-read responses</span>
              </label>
              <button
                onClick={() => setSettingsOpen(o => !o)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all',
                  settingsOpen
                    ? 'border-cyan-400/40 text-cyan-400 bg-cyan-400/10'
                    : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                )}
              >
                <Settings size={12} />
                TTS Settings
              </button>
            </div>

            {/* Collapsible settings panel */}
            {settingsOpen && (
              <div className="w-full rounded-xl border border-white/10 bg-white/3 p-4 space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-cyan-400/70 text-xs uppercase tracking-wider">Voice Settings</p>
                  <button onClick={() => setSettingsOpen(false)} className="text-white/30 hover:text-white/60">
                    <X size={14} />
                  </button>
                </div>

                {/* Wake-word toggle */}
                <div className="flex items-center justify-between py-3 border-b border-cyan-400/10">
                  <div>
                    <p className="text-white/70 text-sm font-medium">Wake-Word Mode</p>
                    <p className="text-white/30 text-xs mt-0.5">Say &quot;Hey NEXUS&quot; to activate</p>
                  </div>
                  <button
                    onClick={toggleWakeWordMode}
                    className={`relative w-11 h-6 rounded-full transition-all ${wakeWordMode ? 'bg-cyan-400/80' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${wakeWordMode ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Voice selector */}
                {availableVoices.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-white/40 text-xs">Voice</label>
                    <select
                      value={selectedVoice}
                      onChange={e => setSelectedVoice(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/70 text-xs focus:outline-none focus:border-cyan-400/40"
                    >
                      {availableVoices.map(v => (
                        <option key={v.name} value={v.name} className="bg-gray-900">
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Speech rate */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-white/40 text-xs">Speech Rate</label>
                    <span className="text-cyan-400/60 text-xs font-mono">{speechRate.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.05}
                    value={speechRate}
                    onChange={e => setSpeechRate(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="flex justify-between text-white/20 text-xs">
                    <span>0.5×</span><span>1.0×</span><span>1.5×</span>
                  </div>
                </div>

                {/* Pitch */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-white/40 text-xs">Pitch</label>
                    <span className="text-cyan-400/60 text-xs font-mono">{speechPitch.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    value={speechPitch}
                    onChange={e => setSpeechPitch(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="flex justify-between text-white/20 text-xs">
                    <span>0.5</span><span>1.0</span><span>1.5</span>
                  </div>
                </div>
              </div>
            )}

            {/* Wake-word status indicator */}
            {wakeWordMode && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 mb-4">
                <div className={`w-2 h-2 rounded-full ${wakeWordActive ? 'bg-cyan-400 animate-pulse' : 'bg-white/20'}`}
                  style={wakeWordActive ? { boxShadow: '0 0 8px #00e5ff' } : {}} />
                <span className="text-xs text-cyan-400/70 nexus-mono">
                  {wakeWordActive ? 'LISTENING FOR "HEY NEXUS"...' : 'WAKE-WORD INACTIVE'}
                </span>
              </div>
            )}

            {/* Orb button */}
            <div className="relative">
              {isRecording && (
                <>
                  <div className="absolute inset-0 rounded-full bg-cyan-400/10 animate-ping" />
                  <div
                    className="absolute -inset-4 rounded-full bg-cyan-400/5 animate-ping"
                    style={{ animationDelay: '0.3s' }}
                  />
                </>
              )}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  'relative w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all duration-300',
                  isRecording
                    ? 'border-red-400 bg-red-400/10 text-red-400 scale-110'
                    : 'border-cyan-400/40 bg-cyan-400/10 text-cyan-400 hover:scale-105 hover:border-cyan-400/70'
                )}
                style={{
                  boxShadow: isRecording
                    ? '0 0 30px rgba(239,68,68,0.3), 0 0 60px rgba(239,68,68,0.1)'
                    : '0 0 20px rgba(0,212,255,0.2)',
                }}
              >
                {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
              </button>
            </div>

            <div className="text-center">
              <p className={cn('text-sm font-medium', isRecording ? 'text-red-400' : 'text-white/60')}>
                {isRecording ? '● Recording...' : 'Push to Talk'}
              </p>
              <p className="text-white/30 text-xs mt-1">
                {isRecording
                  ? 'Speak your command'
                  : 'Click the microphone or hold Space to record'}
              </p>
              {!isRecording && (
                <p className="text-white/20 text-xs mt-0.5">Hold Space to talk</p>
              )}
            </div>

            {/* Waveform bars — deterministic sine-wave heights, animated with CSS */}
            {isRecording && (
              <div className="flex items-end gap-1 h-10">
                {waveformHeights.map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-cyan-400/60 rounded-full"
                    style={{
                      height: `${h}%`,
                      animation: `waveform ${0.6 + (i % 5) * 0.15}s ease-in-out infinite alternate`,
                      animationDelay: `${(i * 50) % 300}ms`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Current transcript */}
          {(transcript || loading) && (
            <div className="glass-panel rounded-xl p-4">
              <p className="text-white/40 text-xs mb-2 uppercase tracking-wider">You said</p>
              <p className="text-white/80 text-sm">{transcript || '...'}</p>
            </div>
          )}

          {/* Current response */}
          {response && (
            <div className="glass-panel rounded-xl p-4 border border-cyan-400/15">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(0,212,255,0.9) 0%, rgba(124,58,237,0.7) 100%)',
                  }}
                />
                <p className="text-cyan-400/70 text-xs uppercase tracking-wider">NEXUS Response</p>
                <Volume2 size={12} className="text-cyan-400/40 ml-auto" />
              </div>
              <p className="text-white/80 text-sm leading-relaxed">{response}</p>
            </div>
          )}

          {/* Conversation history */}
          {history.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-white/30 text-xs uppercase tracking-wider">Recent Exchanges</p>
                <button
                  onClick={() => setHistory([])}
                  className="flex items-center gap-1 text-white/30 hover:text-red-400/70 text-xs transition-colors"
                >
                  <Trash2 size={11} />
                  Clear history
                </button>
              </div>
              <div className="space-y-2">
                {history.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'glass-panel rounded-xl p-4 space-y-3 border transition-all',
                      idx === 0 ? 'border-cyan-400/10' : 'border-white/5 opacity-70'
                    )}
                  >
                    {/* User line */}
                    <div className="flex items-start gap-2">
                      <span className="text-white/25 text-xs mt-0.5 uppercase tracking-wider w-10 flex-shrink-0">You</span>
                      <p className="text-white/60 text-xs leading-relaxed">{entry.userText}</p>
                    </div>
                    {/* NEXUS line */}
                    <div className="flex items-start gap-2">
                      <span className="text-cyan-400/40 text-xs mt-0.5 uppercase tracking-wider w-10 flex-shrink-0">NXS</span>
                      <p className="text-white/50 text-xs leading-relaxed line-clamp-3">{entry.nexusText}</p>
                    </div>
                    {/* Timestamp */}
                    <p className="text-white/15 text-xs text-right">
                      {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Example commands */}
          <div>
            <p className="text-white/30 text-xs uppercase tracking-wider mb-3">Example Commands</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXAMPLE_COMMANDS.map(cmd => (
                <button
                  key={cmd}
                  onClick={() => {
                    setTranscript(cmd)
                    sendToNexus(cmd)
                  }}
                  className="text-left text-xs text-white/50 hover:text-white/80 px-3 py-2.5 rounded-lg border border-white/5 hover:border-cyan-400/20 bg-white/2 hover:bg-cyan-400/5 transition-all flex items-start gap-2"
                >
                  <MessageSquare size={12} className="flex-shrink-0 mt-0.5 text-cyan-400/40" />
                  {cmd}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
