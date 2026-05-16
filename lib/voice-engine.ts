// Voice engine for NEXUS - handles STT and TTS
// This module must only be imported in 'use client' components

export interface VoiceConfig {
  rate: number    // 0.9 default
  pitch: number   // 0.95 default
  volume: number  // 1.0 default
  voice: string   // preferred voice name
}

const DEFAULT_CONFIG: VoiceConfig = {
  rate: 0.9,
  pitch: 0.95,
  volume: 1.0,
  voice: '',
}

// Priority order for voice selection
const VOICE_PRIORITIES = [
  'Google UK English Male',
  'Google UK English Female',
  'Daniel',
  'Alex',
]

/**
 * Get best available voice - prefer clear English voices
 */
export function getBestVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null

  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  // Try exact priority matches first
  for (const priority of VOICE_PRIORITIES) {
    const match = voices.find(v => v.name.includes(priority))
    if (match) return match
  }

  // Try en-GB voices
  const enGB = voices.find(v => v.lang === 'en-GB')
  if (enGB) return enGB

  // Try en-US voices
  const enUS = voices.find(v => v.lang === 'en-US' || v.lang.startsWith('en-US'))
  if (enUS) return enUS

  // Fallback to any English voice
  const anyEn = voices.find(v => v.lang.toLowerCase().startsWith('en'))
  if (anyEn) return anyEn

  return voices[0] || null
}

/**
 * Strip markdown formatting before speaking
 */
export function stripMarkdown(text: string): string {
  return text
    // Remove bold/italic (**text**, *text*, __text__, _text_)
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
    // Remove headings (# ## ###)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove inline code (`code`)
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove links [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bullet points and list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Collapse multiple newlines
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    // Clean up extra spaces
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Speak text aloud, returns a promise that resolves when done
 */
export function speak(text: string, config?: Partial<VoiceConfig>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'))
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const merged: VoiceConfig = { ...DEFAULT_CONFIG, ...config }
    const cleaned = stripMarkdown(text)

    if (!cleaned.trim()) {
      resolve()
      return
    }

    const utterance = new SpeechSynthesisUtterance(cleaned)
    utterance.rate = merged.rate
    utterance.pitch = merged.pitch
    utterance.volume = merged.volume

    // Set voice
    if (merged.voice) {
      const voices = window.speechSynthesis.getVoices()
      const found = voices.find(v => v.name === merged.voice)
      if (found) utterance.voice = found
    } else {
      const best = getBestVoice()
      if (best) utterance.voice = best
    }

    utterance.onend = () => resolve()
    utterance.onerror = (e) => {
      // 'interrupted' is not a real error - it happens when we cancel speech
      if (e.error === 'interrupted' || e.error === 'canceled') {
        resolve()
      } else {
        reject(new Error(`Speech error: ${e.error}`))
      }
    }

    window.speechSynthesis.speak(utterance)
  })
}

/**
 * Cancel current speech
 */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

/**
 * Check if browser supports speech recognition and synthesis
 */
export function isVoiceSupported(): { stt: boolean; tts: boolean } {
  if (typeof window === 'undefined') {
    return { stt: false, tts: false }
  }

  const stt = !!(
    (window as Window & typeof globalThis & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
    (window as Window & typeof globalThis & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  )
  const tts = 'speechSynthesis' in window

  return { stt, tts }
}
