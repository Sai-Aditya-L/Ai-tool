'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Settings, X, Loader2, Volume2 } from 'lucide-react'
import { speak, stopSpeaking, isVoiceSupported, getBestVoice } from '@/lib/voice-engine'

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

const HUD_BG = 'rgba(0,4,12,0.95)'
const CYAN = '#00e5ff'

export function NexusVoiceButton() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [responseText, setResponseText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)

  // Settings
  const [rate, setRate] = useState(0.9)
  const [pitch, setPitch] = useState(0.95)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceName, setSelectedVoiceName] = useState('')

  const recognitionRef = useRef<(EventTarget & { start(): void; stop(): void; abort(): void }) | null>(null)
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)

  // Load voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const load = () => {
      const voices = window.speechSynthesis.getVoices().filter(v =>
        v.lang.toLowerCase().startsWith('en')
      )
      setAvailableVoices(voices)
      if (!selectedVoiceName) {
        const best = getBestVoice()
        if (best) setSelectedVoiceName(best.name)
      }
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load voice enabled state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('nexus-voice-enabled')
    if (stored === 'true') setVoiceEnabled(true)
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      recognitionRef.current?.abort()
      stopSpeaking()
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
    }
  }, [])

  // Keyboard shortcut Ctrl+Shift+V
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        if (voiceState === 'idle') {
          startListening()
        } else if (voiceState === 'listening') {
          recognitionRef.current?.stop()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [voiceState]) // eslint-disable-line react-hooks/exhaustive-deps

  const showError = useCallback((msg: string) => {
    if (!isMountedRef.current) return
    setErrorMsg(msg)
    setVoiceState('error')
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
    errorTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) setVoiceState('idle')
    }, 3000)
  }, [])

  const startListening = useCallback(() => {
    const support = isVoiceSupported()
    if (!support.stt) {
      showError('Voice not supported in this browser')
      return
    }

    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (!SpeechRecognition) {
      showError('Voice not supported in this browser')
      return
    }

    try {
      const recognition = new (SpeechRecognition as new () => EventTarget & {
        continuous: boolean
        interimResults: boolean
        lang: string
        start(): void
        stop(): void
        abort(): void
        onstart: (() => void) | null
        onend: (() => void) | null
        onerror: ((e: { error: string }) => void) | null
        onresult: ((e: { results: { isFinal: boolean; [n: number]: { transcript: string }[] }[]; [n: number]: unknown }) => void) | null
      })()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        if (isMountedRef.current) {
          setVoiceState('listening')
          setTranscript('')
        }
      }

      recognition.onerror = (e: { error: string }) => {
        if (e.error === 'not-allowed') {
          showError('Microphone access denied')
        } else {
          showError('NEXUS unavailable')
        }
      }

      recognition.onend = () => {
        // Will be handled by onresult for final transcript
      }

      recognition.onresult = (e: { results: { isFinal: boolean; [n: number]: { transcript: string }[] }[]; [n: number]: unknown }) => {
        const results = Array.from(e.results as unknown as Array<{ isFinal: boolean; [n: number]: { transcript: string } }>)
        const text = results.map(r => r[0].transcript).join('')
        if (isMountedRef.current) setTranscript(text)

        const lastResult = results[results.length - 1] as { isFinal: boolean; [n: number]: { transcript: string } }
        if (lastResult.isFinal) {
          recognition.stop()
          if (isMountedRef.current && text.trim()) {
            sendToNexus(text.trim())
          } else {
            if (isMountedRef.current) setVoiceState('idle')
          }
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch {
      showError('Microphone access denied')
    }
  }, [showError]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendToNexus = useCallback(async (text: string) => {
    if (!isMountedRef.current) return
    setVoiceState('processing')

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
        showError('NEXUS unavailable')
        return
      }

      // Parse as JSON — the chat API returns JSON responses
      let fullText = ''
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const json = await res.json()
        fullText = json.message || json.content || json.text || ''
      } else {
        // SSE / streaming fallback
        const reader = res.body?.getReader()
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
                const delta = parsed?.delta?.text || parsed?.choices?.[0]?.delta?.content || parsed?.text || parsed?.content || ''
                if (delta) fullText += delta
              } catch {
                if (data) fullText += data
              }
            }
          }
        }
      }

      if (!isMountedRef.current) return

      if (!fullText.trim()) {
        showError('NEXUS unavailable')
        return
      }

      setResponseText(fullText)
      setVoiceState('speaking')

      await speak(fullText, {
        rate,
        pitch,
        voice: selectedVoiceName,
      })

      if (isMountedRef.current) setVoiceState('idle')
    } catch {
      if (isMountedRef.current) showError('NEXUS unavailable')
    }
  }, [rate, pitch, selectedVoiceName, showError])

  const handleButtonClick = () => {
    if (voiceState === 'idle' || voiceState === 'error') {
      startListening()
    } else if (voiceState === 'listening') {
      recognitionRef.current?.stop()
      setVoiceState('idle')
    } else if (voiceState === 'speaking') {
      stopSpeaking()
      setVoiceState('idle')
    }
  }

  const toggleVoiceEnabled = () => {
    const next = !voiceEnabled
    setVoiceEnabled(next)
    localStorage.setItem('nexus-voice-enabled', String(next))
  }

  if (!voiceEnabled) {
    // Compact enable button
    return (
      <div className="fixed bottom-6 left-6 z-50 flex flex-col items-center gap-2">
        <motion.button
          onClick={toggleVoiceEnabled}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          title="Enable NEXUS Voice"
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: HUD_BG,
            border: `1px solid rgba(0,229,255,0.15)`,
            boxShadow: '0 0 12px rgba(0,229,255,0.08)',
          }}
        >
          <Mic size={18} style={{ color: 'rgba(0,229,255,0.35)' }} />
        </motion.button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-end gap-3">
      {/* Transcript / response bubble */}
      <AnimatePresence>
        {(transcript || responseText) && voiceState !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="max-w-xs rounded-xl p-3 text-xs leading-relaxed"
            style={{
              background: HUD_BG,
              border: `1px solid rgba(0,229,255,0.2)`,
              boxShadow: '0 4px 24px rgba(0,229,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            {voiceState === 'listening' && transcript && (
              <p style={{ color: 'rgba(255,255,255,0.6)' }}>{transcript}</p>
            )}
            {(voiceState === 'speaking' || voiceState === 'processing') && (
              <>
                {transcript && (
                  <p className="mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    You: {transcript}
                  </p>
                )}
                {responseText && (
                  <p style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {responseText.slice(0, 200)}{responseText.length > 200 ? '...' : ''}
                  </p>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error bubble */}
      <AnimatePresence>
        {voiceState === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="max-w-xs rounded-xl px-3 py-2 text-xs"
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171',
            }}
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings dropdown */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="rounded-xl p-4 space-y-4 w-64"
            style={{
              background: HUD_BG,
              border: `1px solid rgba(0,229,255,0.15)`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest" style={{ color: CYAN }}>
                Voice Settings
              </span>
              <button onClick={() => setShowSettings(false)}>
                <X size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
              </button>
            </div>

            {/* Rate slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <span>Speed</span>
                <span style={{ color: CYAN }}>{rate.toFixed(2)}x</span>
              </div>
              <input
                type="range" min={0.5} max={2.0} step={0.05}
                value={rate}
                onChange={e => setRate(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            {/* Pitch slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <span>Pitch</span>
                <span style={{ color: CYAN }}>{pitch.toFixed(2)}</span>
              </div>
              <input
                type="range" min={0.5} max={2.0} step={0.05}
                value={pitch}
                onChange={e => setPitch(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            {/* Voice dropdown */}
            {availableVoices.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Voice</label>
                <select
                  value={selectedVoiceName}
                  onChange={e => setSelectedVoiceName(e.target.value)}
                  className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  {availableVoices.map(v => (
                    <option key={v.name} value={v.name} className="bg-gray-900">
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Disable button */}
            <button
              onClick={toggleVoiceEnabled}
              className="w-full py-1.5 rounded-lg text-xs transition-all"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
              }}
            >
              Disable Voice
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main button row */}
      <div className="flex items-center gap-2">
        {/* Settings gear */}
        <motion.button
          onClick={() => setShowSettings(s => !s)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(0,229,255,0.05)',
            border: '1px solid rgba(0,229,255,0.1)',
          }}
        >
          <Settings size={12} style={{ color: 'rgba(0,229,255,0.5)' }} />
        </motion.button>

        {/* Main voice FAB */}
        <div className="relative">
          {/* Idle pulse ring */}
          {voiceState === 'idle' && (
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0, 0.15] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: CYAN }}
            />
          )}

          {/* Listening red pulse */}
          {voiceState === 'listening' && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0, 0.2] }}
                transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                style={{ background: '#ef4444' }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{ scale: [1, 1.8, 1], opacity: [0.1, 0, 0.1] }}
                transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                style={{ background: '#ef4444' }}
              />
            </>
          )}

          <motion.button
            onClick={handleButtonClick}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            className="relative w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5"
            style={{
              background: voiceState === 'listening'
                ? 'rgba(239,68,68,0.15)'
                : voiceState === 'error'
                  ? 'rgba(239,68,68,0.1)'
                  : HUD_BG,
              border: voiceState === 'listening'
                ? '1.5px solid rgba(239,68,68,0.6)'
                : voiceState === 'speaking'
                  ? `1.5px solid ${CYAN}`
                  : voiceState === 'processing'
                    ? '1.5px solid rgba(0,229,255,0.4)'
                    : `1.5px solid rgba(0,229,255,0.25)`,
              boxShadow: voiceState === 'listening'
                ? '0 0 20px rgba(239,68,68,0.25)'
                : voiceState === 'speaking'
                  ? `0 0 24px rgba(0,229,255,0.3)`
                  : '0 0 16px rgba(0,229,255,0.1)',
            }}
          >
            {/* Idle state */}
            {voiceState === 'idle' && (
              <Mic size={20} style={{ color: CYAN }} />
            )}

            {/* Listening: 3 bouncing waveform bars */}
            {voiceState === 'listening' && (
              <div className="flex items-end gap-0.5 h-5">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-full"
                    style={{ background: '#ef4444' }}
                    animate={{ height: ['40%', '100%', '40%'] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.15,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Processing: spinner */}
            {voiceState === 'processing' && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 size={20} style={{ color: CYAN }} />
              </motion.div>
            )}

            {/* Speaking: sound waves */}
            {voiceState === 'speaking' && (
              <Volume2 size={20} style={{ color: CYAN }} />
            )}

            {/* Error: X */}
            {voiceState === 'error' && (
              <X size={20} style={{ color: '#f87171' }} />
            )}
          </motion.button>
        </div>
      </div>

      {/* Status label */}
      <AnimatePresence mode="wait">
        {voiceState !== 'idle' && (
          <motion.p
            key={voiceState}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-center text-xs tracking-widest font-mono"
            style={{
              color: voiceState === 'listening'
                ? '#ef4444'
                : voiceState === 'error'
                  ? '#f87171'
                  : CYAN,
            }}
          >
            {voiceState === 'listening' && 'LISTENING...'}
            {voiceState === 'processing' && 'PROCESSING...'}
            {voiceState === 'speaking' && 'SPEAKING...'}
            {voiceState === 'error' && 'ERROR'}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
