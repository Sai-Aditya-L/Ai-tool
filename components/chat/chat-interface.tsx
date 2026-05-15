'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Mic, Paperclip, Zap, RotateCcw, Copy, Check, StopCircle } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: string[]
  timestamp: Date
  loading?: boolean
}

const SUGGESTED_PROMPTS = [
  "What do I have on my schedule today?",
  "Create a task to review project documents by Friday",
  "Set a reminder for tomorrow at 9 AM for team standup",
  "Summarize what I've been working on this week",
  "Track my Netflix subscription, $15.99/month",
  "Create a note about the project architecture decisions",
  "What tasks are marked as urgent?",
  "Save to memory: I prefer dark themes in all my apps",
]

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `**NEXUS online.** Neural link established.\n\nI'm your AI personal operating system, ready to help you manage your digital life. I can:\n\n• **Manage tasks & reminders** — create, update, track deadlines\n• **Take notes** — save and search your thoughts\n• **Track bills & subscriptions** — monitor your expenses\n• **Remember your preferences** — learn what matters to you\n• **Summarize your day** — give you a full briefing\n\nWhat can I help you with today?`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text?: string) => {
    const content = text || input.trim()
    if (!content || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    const loadingMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true,
    }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInput('')
    setLoading(true)

    const allMessages = [
      ...messages.filter(m => !m.loading),
      userMsg,
    ].map(m => ({ role: m.role, content: m.content }))

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          conversationId,
        }),
        signal: abortRef.current.signal,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Request failed')
      }

      if (data.conversationId) setConversationId(data.conversationId)

      setMessages(prev => prev.map(m =>
        m.loading
          ? { ...m, content: data.message, loading: false, toolsUsed: data.toolsUsed }
          : m
      ))
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages(prev => prev.filter(m => !m.loading))
        return
      }
      toast.error('NEXUS connection lost. Retrying...')
      setMessages(prev => prev.map(m =>
        m.loading
          ? { ...m, content: 'Neural link interrupted. Please try again.', loading: false }
          : m
      ))
    } finally {
      setLoading(false)
      abortRef.current = null
      inputRef.current?.focus()
    }
  }, [input, loading, messages, conversationId])

  function stopGeneration() {
    abortRef.current?.abort()
    setLoading(false)
  }

  function copyMessage(id: string, content: string) {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function clearConversation() {
    setMessages([{
      id: '0',
      role: 'assistant',
      content: `**NEXUS ready.** New session initialized. How can I assist you?`,
      timestamp: new Date(),
    }])
    setConversationId(null)
  }

  function formatContent(content: string) {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-cyan-400/10 text-cyan-400 px-1 py-0.5 rounded text-sm nexus-mono">$1</code>')
      .replace(/\n/g, '<br/>')
      .replace(/^• /gm, '&bull; ')
      .replace(/^## (.*$)/gm, '<h3 class="text-white font-semibold mt-3 mb-1">$1</h3>')
      .replace(/^# (.*$)/gm, '<h2 class="text-white font-bold mt-3 mb-2 text-lg">$1</h2>')
  }

  return (
    <div className="flex h-full">
      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-3 group',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.9) 0%, rgba(124,58,237,0.7) 100%)' }}
                >
                  <span className="text-white text-[10px] font-bold">N</span>
                </div>
              )}

              <div className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 relative',
                msg.role === 'user'
                  ? 'bg-cyan-400/10 border border-cyan-400/20 text-white rounded-tr-sm'
                  : 'glass-panel rounded-tl-sm'
              )}>
                {msg.loading ? (
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-white/40 text-xs">NEXUS processing...</span>
                  </div>
                ) : (
                  <>
                    <div
                      className="text-white/85 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                    />
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {msg.toolsUsed.map((tool, i) => (
                          <span key={i} className="text-[10px] text-cyan-400/60 bg-cyan-400/5 border border-cyan-400/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Zap size={8} />
                            {tool.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-white/20 text-[10px]">
                        {formatRelativeTime(msg.timestamp)}
                      </span>
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => copyMessage(msg.id, msg.content)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-cyan-400 ml-2"
                        >
                          {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full flex-shrink-0 bg-white/10 border border-white/20 flex items-center justify-center mt-0.5">
                  <span className="text-white/60 text-[10px] font-bold">U</span>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested prompts (show when only 1 message) */}
        {messages.length === 1 && (
          <div className="px-4 pb-3">
            <p className="text-white/25 text-xs mb-2 uppercase tracking-wider">Quick commands</p>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTED_PROMPTS.slice(0, 4).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left text-xs text-white/50 hover:text-white/80 px-3 py-2 rounded-lg border border-white/5 hover:border-cyan-400/20 bg-white/2 hover:bg-cyan-400/5 transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-cyan-400/10">
          <div className="flex items-end gap-3 glass-panel rounded-2xl px-4 py-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message NEXUS... (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="flex-1 bg-transparent text-white/85 placeholder-white/25 outline-none resize-none text-sm leading-relaxed"
              style={{ minHeight: '24px', maxHeight: '200px' }}
              onInput={(e) => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = `${t.scrollHeight}px`
              }}
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              <button className="text-white/30 hover:text-cyan-400 transition-colors p-1" title="Voice input">
                <Mic size={16} />
              </button>
              <button className="text-white/30 hover:text-cyan-400 transition-colors p-1" title="Attach file">
                <Paperclip size={16} />
              </button>
              <button
                onClick={() => clearConversation()}
                className="text-white/30 hover:text-white/60 transition-colors p-1"
                title="New conversation"
              >
                <RotateCcw size={16} />
              </button>
              {loading ? (
                <button
                  onClick={stopGeneration}
                  className="w-8 h-8 rounded-lg bg-red-400/10 border border-red-400/30 flex items-center justify-center text-red-400 hover:bg-red-400/20 transition-all"
                >
                  <StopCircle size={16} />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                  className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 hover:bg-cyan-400/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
          <p className="text-center text-white/20 text-[10px] mt-2 nexus-mono">
            NEXUS — Neural EXtended Universal System v1.0
          </p>
        </div>
      </div>
    </div>
  )
}
