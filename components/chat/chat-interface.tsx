'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Mic, Paperclip, Zap, RotateCcw, Copy, Check, StopCircle, MessageSquare, Plus, Trash2, ChevronLeft, ChevronRight, History, ImageIcon, X as XIcon, FileText, Globe } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: string[]
  timestamp: Date
  loading?: boolean
  tokens?: number
  image?: string
  toolStatus?: string
  originalContent?: string
}

interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
  messages: { content: string }[]
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

const TRANSLATE_LANGUAGES = ['Spanish', 'French', 'German', 'Japanese', 'Arabic', 'Hindi']

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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingConversation, setLoadingConversation] = useState<string | null>(null)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [pendingPdf, setPendingPdf] = useState<{ name: string; text: string; pages: number } | null>(null)
  const [translatingId, setTranslatingId] = useState<string | null>(null)
  const [showTranslateMenu, setShowTranslateMenu] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // Fetch conversation list on mount and whenever sidebar opens
  useEffect(() => {
    fetchConversations()
  }, [])

  async function fetchConversations() {
    try {
      const res = await fetch('/api/conversations')
      if (!res.ok) return
      const data = await res.json()
      setConversations(data.conversations ?? [])
    } catch {
      // silently fail — sidebar is non-critical
    }
  }

  async function loadConversation(id: string) {
    if (loadingConversation) return
    setLoadingConversation(id)
    try {
      const res = await fetch(`/api/conversations/${id}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      const conv = data.conversation
      const loaded: Message[] = conv.messages.map((m: any) => {
        let toolsUsed: string[] | undefined
        if (m.toolCalls) {
          try {
            toolsUsed = typeof m.toolCalls === 'string' ? JSON.parse(m.toolCalls) : m.toolCalls
          } catch {
            toolsUsed = undefined
          }
        }
        return {
          id: m.id ?? Date.now().toString(),
          role: m.role as 'user' | 'assistant',
          content: m.content,
          toolsUsed,
          timestamp: m.createdAt ? new Date(m.createdAt) : new Date(),
        }
      })
      setMessages(loaded)
      setConversationId(id)
    } catch {
      toast.error('Failed to load conversation')
    } finally {
      setLoadingConversation(null)
    }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setConversations(prev => prev.filter(c => c.id !== id))
      if (conversationId === id) clearConversation()
    } catch {
      toast.error('Failed to delete conversation')
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => setPendingImage(ev.target?.result as string)
    reader.readAsDataURL(file)
    // reset input
    e.target.value = ''
  }

  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('PDF must be under 20MB')
      return
    }
    const toastId = toast.loading('Extracting PDF text...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/tools/pdf', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('PDF extraction failed')
      const data = await res.json()
      setPendingPdf({ name: data.filename, text: data.text, pages: data.pages })
      toast.success(`PDF attached — ${data.pages} page${data.pages !== 1 ? 's' : ''}${data.truncated ? ' (truncated)' : ''}`, { id: toastId })
    } catch {
      toast.error('Failed to extract PDF text', { id: toastId })
    }
    e.target.value = ''
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (typeof ev.target?.result === 'string') {
          setPendingImage(ev.target.result)
          toast.success('Screenshot attached — ask NEXUS about it')
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const translateMessage = async (msgId: string, text: string, targetLanguage: string) => {
    setShowTranslateMenu(null)
    setTranslatingId(msgId)
    try {
      const res = await fetch('/api/tools/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage }),
      })
      if (!res.ok) throw new Error('Translation failed')
      const data = await res.json()
      setMessages(prev => prev.map(m =>
        m.id === msgId
          ? { ...m, originalContent: m.originalContent ?? m.content, content: `${data.translated}\n\n*(translated to ${targetLanguage})*` }
          : m
      ))
      toast.success(`Translated to ${targetLanguage}`)
    } catch {
      toast.error('Translation failed')
    } finally {
      setTranslatingId(null)
    }
  }

  const sendMessage = useCallback(async (text?: string) => {
    const content = text || input.trim()
    if (!content && !pendingImage && !pendingPdf) return
    if (loading) return

    const capturedImage = pendingImage
    const capturedPdf = pendingPdf

    let finalContent = content
    if (capturedPdf) {
      const userText = content || 'Please analyze this PDF.'
      finalContent = `[PDF: ${capturedPdf.name}, ${capturedPdf.pages} pages]\n\n${capturedPdf.text}\n\n---\n\nUser question: ${userText}`
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: finalContent,
      timestamp: new Date(),
      image: capturedImage || undefined,
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
    setPendingImage(null)
    setPendingPdf(null)
    setLoading(true)

    const allMessages = [
      ...messages.filter(m => !m.loading),
      userMsg,
    ].map(m => {
      if (m.image) {
        return { role: m.role, content: m.content, text: m.content, image: m.image }
      }
      return { role: m.role, content: m.content }
    })

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
          ? { ...m, content: data.message, loading: false, toolsUsed: data.toolsUsed, tokens: data.tokens }
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
  }, [input, loading, messages, conversationId, pendingImage, pendingPdf])

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
    fetchConversations()
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
    <div className="flex h-full" onClick={() => showTranslateMenu && setShowTranslateMenu(null)}>
      {/* Conversation history sidebar */}
      <div
        className={cn(
          'relative flex-shrink-0 flex flex-col border-r border-cyan-400/10 glass-panel transition-all duration-300 overflow-hidden',
          sidebarOpen ? 'w-64' : 'w-0'
        )}
      >
        {/* Sidebar content — always rendered so transition is smooth */}
        <div className="flex flex-col h-full w-64">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-3 border-b border-cyan-400/10 flex-shrink-0">
            <History size={14} className="text-cyan-400 flex-shrink-0" />
            <span className="text-white/70 text-xs font-semibold uppercase tracking-wider flex-1 truncate">History</span>
          </div>

          {/* New Chat button */}
          <div className="px-2 py-2 flex-shrink-0">
            <button
              onClick={() => { clearConversation() }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 hover:bg-cyan-400/10 text-cyan-400 text-xs font-medium transition-all"
            >
              <Plus size={13} />
              New Chat
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-24 gap-2 text-white/25">
                <MessageSquare size={20} />
                <span className="text-[11px]">No conversations yet</span>
              </div>
            )}
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                disabled={loadingConversation === conv.id}
                className={cn(
                  'group w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-all border',
                  conversationId === conv.id
                    ? 'border-cyan-400/30 bg-cyan-400/10 text-white/90'
                    : 'border-transparent hover:border-cyan-400/10 hover:bg-white/5 text-white/60 hover:text-white/80',
                  loadingConversation === conv.id && 'opacity-50 cursor-wait'
                )}
              >
                <MessageSquare size={12} className="flex-shrink-0 mt-0.5 text-cyan-400/50" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate leading-snug">
                    {conv.title || 'Untitled'}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {formatRelativeTime(new Date(conv.updatedAt))}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400 p-0.5 rounded"
                  title="Delete conversation"
                >
                  <Trash2 size={11} />
                </button>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar toggle button */}
      <div className="relative flex-shrink-0 flex items-start pt-3">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="z-10 flex items-center justify-center w-5 h-8 rounded-r-lg bg-white/5 border border-l-0 border-cyan-400/10 hover:bg-cyan-400/10 hover:border-cyan-400/20 text-white/40 hover:text-cyan-400 transition-all"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Session token total */}
        {(() => {
          const totalTokens = messages.reduce((sum, m) => sum + (m.tokens ?? 0), 0)
          return totalTokens > 0 ? (
            <div className="flex justify-end px-4 pt-2">
              <span className="text-white/20 text-[10px] nexus-mono">Session: ~{totalTokens.toLocaleString()} tokens</span>
            </div>
          ) : null
        })()}
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
                    {msg.toolStatus && (
                      <div className="flex items-center gap-2 text-xs text-cyan-400/60 mb-1 nexus-mono">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        {msg.toolStatus}
                      </div>
                    )}
                    {msg.image && (
                      <img
                        src={msg.image}
                        alt="Uploaded"
                        className="max-w-[280px] rounded-lg mb-2 border border-cyan-400/20"
                      />
                    )}
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
                    {msg.role === 'assistant' && msg.tokens != null && msg.tokens > 0 && (
                      <span className="text-white/20 text-[10px] nexus-mono mt-1 block">{msg.tokens} tokens</span>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-white/20 text-[10px]">
                        {formatRelativeTime(msg.timestamp)}
                      </span>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-1">
                          {/* Translate button */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowTranslateMenu(prev => prev === msg.id ? null : msg.id)
                              }}
                              disabled={translatingId === msg.id}
                              className={cn(
                                'opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-cyan-400 p-0.5',
                                translatingId === msg.id && 'opacity-100 text-cyan-400 animate-pulse'
                              )}
                              title="Translate message"
                            >
                              <Globe size={12} />
                            </button>
                            {showTranslateMenu === msg.id && (
                              <div
                                className="absolute bottom-full right-0 mb-1 z-50 glass-panel border border-cyan-400/20 rounded-lg py-1 min-w-[120px] shadow-lg"
                                onClick={e => e.stopPropagation()}
                              >
                                {msg.originalContent && (
                                  <button
                                    onClick={() => {
                                      setMessages(prev => prev.map(m =>
                                        m.id === msg.id && m.originalContent
                                          ? { ...m, content: m.originalContent, originalContent: undefined }
                                          : m
                                      ))
                                      setShowTranslateMenu(null)
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-400/10 transition-colors"
                                  >
                                    Original
                                  </button>
                                )}
                                {TRANSLATE_LANGUAGES.map(lang => (
                                  <button
                                    key={lang}
                                    onClick={() => translateMessage(msg.id, msg.originalContent ?? msg.content, lang)}
                                    className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-cyan-400/10 transition-colors"
                                  >
                                    {lang}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Copy button */}
                          <button
                            onClick={() => copyMessage(msg.id, msg.content)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-cyan-400 ml-1"
                          >
                            {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
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
          <div className="flex flex-col glass-panel rounded-2xl">
            {pendingImage && (
              <div className="px-4 pt-3 flex items-start gap-2">
                <div className="relative">
                  <img src={pendingImage} alt="Pending" className="h-16 w-16 object-cover rounded-lg border border-cyan-400/30" />
                  <button
                    onClick={() => setPendingImage(null)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center"
                  >
                    <XIcon size={8} className="text-white" />
                  </button>
                </div>
                <span className="text-xs text-white/40 mt-1">Image attached — describe what you need</span>
              </div>
            )}
            {pendingPdf && (
              <div className="px-4 pt-3 flex items-center gap-2">
                <div className="flex items-center gap-2 bg-cyan-400/10 border border-cyan-400/20 rounded-lg px-3 py-2 flex-1 min-w-0">
                  <FileText size={14} className="text-cyan-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/80 truncate">{pendingPdf.name}</p>
                    <p className="text-[10px] text-white/40">{pendingPdf.pages} page{pendingPdf.pages !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => setPendingPdf(null)}
                    className="flex-shrink-0 text-white/40 hover:text-red-400 transition-colors"
                  >
                    <XIcon size={12} />
                  </button>
                </div>
              </div>
            )}
          <div className="flex items-end gap-3 px-4 py-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
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
              {/* Image upload button */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className={cn(
                  'p-2 rounded-lg transition-all text-white/30 hover:text-cyan-400 hover:bg-cyan-400/5 border border-transparent hover:border-cyan-400/15',
                  pendingImage && 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
                )}
                title="Attach image"
              >
                <ImageIcon size={16} />
              </button>
              {/* PDF upload button */}
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handlePdfSelect}
              />
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className={cn(
                  'p-2 rounded-lg transition-all text-white/30 hover:text-cyan-400 hover:bg-cyan-400/5 border border-transparent hover:border-cyan-400/15',
                  pendingPdf && 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
                )}
                title="Attach PDF"
              >
                <FileText size={16} />
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
                  disabled={!input.trim() && !pendingImage && !pendingPdf}
                  className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 hover:bg-cyan-400/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
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
