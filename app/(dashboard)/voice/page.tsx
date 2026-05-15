'use client'

import { useState, useRef, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Mic, MicOff, Volume2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function VoicePage() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        setSupported(false)
      }
    }
  }, [])

  function startRecording() {
    if (!supported) {
      toast.error('Speech recognition not supported in this browser. Use Chrome or Edge.')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
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
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join('')
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
      setResponse(data.message || '')

      // Text to speech
      if ('speechSynthesis' in window && data.message) {
        const utterance = new SpeechSynthesisUtterance(data.message.replace(/\*\*?(.*?)\*\*?/g, '$1').replace(/[#•]/g, ''))
        utterance.rate = 0.95
        utterance.pitch = 1
        window.speechSynthesis.speak(utterance)
      }
    } catch {
      toast.error('Voice command failed')
    } finally {
      setLoading(false)
    }
  }

  const EXAMPLE_COMMANDS = [
    "What tasks are due today?",
    "Create a reminder for my meeting tomorrow at 2 PM",
    "Summarize my day",
    "Add a note about the project architecture",
    "Set a high priority task: review the codebase",
    "What are my upcoming reminders?",
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
            <div className="relative">
              {isRecording && (
                <>
                  <div className="absolute inset-0 rounded-full bg-cyan-400/10 animate-ping" />
                  <div className="absolute -inset-4 rounded-full bg-cyan-400/5 animate-ping" style={{ animationDelay: '0.3s' }} />
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
                {isRecording ? 'Speak your command' : 'Click the microphone to start voice input'}
              </p>
            </div>

            {/* Waveform bars */}
            {isRecording && (
              <div className="flex items-center gap-1 h-8">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-cyan-400/60 rounded-full"
                    style={{
                      height: `${20 + Math.random() * 100}%`,
                      animation: `waveform ${0.8 + Math.random() * 0.8}s ease-in-out infinite`,
                      animationDelay: `${i * 0.05}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Transcript */}
          {(transcript || loading) && (
            <div className="glass-panel rounded-xl p-4">
              <p className="text-white/40 text-xs mb-2 uppercase tracking-wider">You said</p>
              <p className="text-white/80 text-sm">{transcript || '...'}</p>
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="glass-panel rounded-xl p-4 border border-cyan-400/15">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.9) 0%, rgba(124,58,237,0.7) 100%)' }}
                />
                <p className="text-cyan-400/70 text-xs uppercase tracking-wider">NEXUS Response</p>
                <Volume2 size={12} className="text-cyan-400/40 ml-auto" />
              </div>
              <p className="text-white/80 text-sm leading-relaxed">{response}</p>
            </div>
          )}

          {/* Example commands */}
          <div>
            <p className="text-white/30 text-xs uppercase tracking-wider mb-3">Example Commands</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXAMPLE_COMMANDS.map(cmd => (
                <button
                  key={cmd}
                  onClick={() => { setTranscript(cmd); sendToNexus(cmd) }}
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
