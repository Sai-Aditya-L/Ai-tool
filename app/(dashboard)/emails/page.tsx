'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Mail, RefreshCw, Star, Archive, Trash2, Reply, Sparkles, AlertCircle, ExternalLink, Search, Filter, Inbox, Send, Clock } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface Email {
  id: string
  threadId: string
  from: string
  fromName: string
  to: string
  subject: string
  snippet: string
  labels: string[]
  isRead: boolean
  isStarred: boolean
  isImportant: boolean
  receivedAt: string
}

interface EmailDetail {
  body: string
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [emailBody, setEmailBody] = useState<string | null>(null)
  const [bodyLoading, setBodyLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred' | 'important'>('all')
  const [summarizing, setSummarizing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [draftForm, setDraftForm] = useState({ to: '', subject: '', body: '' })

  useEffect(() => { fetchEmails() }, [filter])

  const fetchEmails = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter === 'unread') params.set('unreadOnly', 'true')
      if (search) params.set('q', search)
      params.set('maxResults', '30')

      const res = await fetch(`/api/emails?${params}`)
      const data = await res.json()

      setConnected(data.connected ?? false)
      setEmails(data.emails || [])
    } catch {
      toast.error('Failed to load emails')
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  async function openEmail(email: Email) {
    setSelectedEmail(email)
    setEmailBody(null)
    setDrafting(false)
    setBodyLoading(true)
    try {
      const res = await fetch(`/api/emails/${email.id}`)
      const data = await res.json()
      setEmailBody(data.body || email.snippet)
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e))
    } catch {
      setEmailBody(email.snippet)
    } finally {
      setBodyLoading(false)
    }
  }

  async function summarizeEmails() {
    setSummarizing(true)
    setSummary(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: 'Summarize my recent emails. Use the get_emails and summarize_emails tools to give me a briefing on what\'s in my inbox.',
          }],
        }),
      })
      const data = await res.json()
      setSummary(data.message)
    } catch {
      toast.error('Failed to generate summary')
    } finally {
      setSummarizing(false)
    }
  }

  async function generateDraft() {
    if (!selectedEmail || !emailBody) return
    setDrafting(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Draft a professional reply to this email from ${selectedEmail.fromName || selectedEmail.from}.\n\nSubject: ${selectedEmail.subject}\n\nEmail content:\n${emailBody}\n\nGenerate a thoughtful reply. Just provide the email body text.`,
          }],
        }),
      })
      const data = await res.json()
      setDraftForm({
        to: selectedEmail.from,
        subject: `Re: ${selectedEmail.subject}`,
        body: data.message,
      })
    } catch {
      toast.error('Failed to generate draft')
    } finally {
      setDrafting(false)
    }
  }

  async function saveDraft() {
    if (!selectedEmail || !draftForm.body) return
    try {
      const res = await fetch(`/api/emails/${selectedEmail.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draftForm, action: 'draft' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Draft saved to Gmail!')
      setDrafting(false)
    } catch {
      toast.error('Failed to save draft')
    }
  }

  const filteredEmails = emails.filter(e => {
    if (filter === 'starred') return e.isStarred
    if (filter === 'important') return e.isImportant
    return true
  })

  if (!connected && !loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Header title="Email Assistant" subtitle="Gmail integration" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="glass-panel rounded-2xl p-8 max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center mx-auto">
              <Mail size={28} className="text-cyan-400/60" />
            </div>
            <h2 className="text-white font-semibold text-lg">Connect Gmail</h2>
            <p className="text-white/50 text-sm">
              Connect your Google account to access Gmail through NEXUS. NEXUS can read, summarize, and help you draft replies.
            </p>
            <div className="space-y-2 text-left">
              {['Read and summarize emails', 'Detect bills, deadlines & meetings', 'AI-powered reply drafting', 'Action item extraction'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-white/60">
                  <span className="text-cyan-400">✓</span> {f}
                </div>
              ))}
            </div>
            <Link href="/api/integrations/google/auth" className="nexus-btn-primary w-full flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Connect Google Account
            </Link>
            <Link href="/integrations" className="text-white/30 text-xs hover:text-white/50 transition-colors">
              Manage all integrations →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Email Assistant" subtitle={connected ? `${emails.filter(e => !e.isRead).length} unread` : 'Gmail'} />
      <div className="flex flex-1 overflow-hidden">

        {/* Email list */}
        <div className={cn(
          'flex flex-col border-r border-cyan-400/10 overflow-hidden',
          selectedEmail ? 'w-80 hidden md:flex' : 'flex-1'
        )}>
          {/* Toolbar */}
          <div className="p-3 border-b border-cyan-400/10 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchEmails()}
                  placeholder="Search emails..."
                  className="nexus-input pl-8 text-xs py-2"
                />
              </div>
              <button onClick={fetchEmails} className="p-2 text-white/40 hover:text-cyan-400 transition-colors" title="Refresh">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={summarizeEmails}
                disabled={summarizing}
                className="nexus-btn-primary text-xs py-1.5 px-3 flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles size={12} />
                {summarizing ? 'Summarizing...' : 'AI Summary'}
              </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1">
              {(['all', 'unread', 'starred', 'important'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs capitalize transition-all',
                    filter === f ? 'bg-cyan-400/15 text-cyan-400 border border-cyan-400/30' : 'text-white/40 hover:text-white/60'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* AI Summary panel */}
          {summary && (
            <div className="m-3 p-3 glass-panel rounded-xl border border-violet-500/20 text-sm text-white/70 leading-relaxed">
              <div className="flex items-center justify-between mb-2">
                <span className="text-violet-400 text-xs font-medium flex items-center gap-1"><Sparkles size={10} /> AI Summary</span>
                <button onClick={() => setSummary(null)} className="text-white/30 hover:text-white/60 text-xs">✕</button>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-7 h-7 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="text-center py-12">
                <Inbox size={32} className="text-white/20 mx-auto mb-3" />
                <p className="text-white/35 text-sm">No emails found</p>
              </div>
            ) : (
              filteredEmails.map(email => (
                <button
                  key={email.id}
                  onClick={() => openEmail(email)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/3 transition-all',
                    selectedEmail?.id === email.id ? 'bg-cyan-400/5 border-l-2 border-l-cyan-400' : '',
                    !email.isRead ? 'bg-white/2' : ''
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={cn('text-sm truncate', !email.isRead ? 'text-white font-semibold' : 'text-white/70')}>
                      {email.fromName || email.from}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {email.isImportant && <span className="text-yellow-400 text-[10px]">!</span>}
                      {email.isStarred && <Star size={10} className="text-yellow-400 fill-yellow-400" />}
                      {!email.isRead && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />}
                    </div>
                  </div>
                  <p className={cn('text-xs truncate mb-1', !email.isRead ? 'text-white/80' : 'text-white/50')}>
                    {email.subject}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-white/30 text-xs truncate flex-1 mr-2">{email.snippet}</p>
                    <span className="text-white/25 text-[10px] flex-shrink-0">{formatRelativeTime(email.receivedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Email detail */}
        {selectedEmail ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Email header */}
            <div className="p-4 border-b border-cyan-400/10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-semibold text-base">{selectedEmail.subject}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-full bg-cyan-400/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-cyan-400 text-[10px] font-bold">
                        {(selectedEmail.fromName || selectedEmail.from).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/70 text-sm font-medium">{selectedEmail.fromName}</span>
                      <span className="text-white/35 text-xs ml-2">&lt;{selectedEmail.from}&gt;</span>
                    </div>
                    <span className="text-white/25 text-xs ml-auto">{formatRelativeTime(selectedEmail.receivedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={generateDraft}
                    disabled={drafting || bodyLoading}
                    className="nexus-btn-primary text-xs py-1.5 px-3 flex items-center gap-1 disabled:opacity-50"
                  >
                    <Sparkles size={12} />
                    {drafting ? 'Drafting...' : 'AI Reply'}
                  </button>
                  <button className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
                    <Reply size={16} />
                  </button>
                  <button onClick={() => setSelectedEmail(null)} className="md:hidden p-1.5 text-white/30 hover:text-white/60">✕</button>
                </div>
              </div>
            </div>

            {/* Email body */}
            <div className="flex-1 overflow-y-auto p-4">
              {bodyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-7 h-7 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  <pre className="text-white/70 text-sm font-sans whitespace-pre-wrap leading-relaxed">
                    {emailBody || selectedEmail.snippet}
                  </pre>
                </div>
              )}
            </div>

            {/* Draft compose panel */}
            {draftForm.body && (
              <div className="border-t border-cyan-400/10 p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-cyan-400/70 text-sm font-medium flex items-center gap-2">
                    <Sparkles size={14} /> AI-Generated Draft
                  </p>
                  <div className="flex gap-2">
                    <button onClick={saveDraft} className="nexus-btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                      <Send size={12} /> Save as Gmail Draft
                    </button>
                    <button onClick={() => setDraftForm({ to: '', subject: '', body: '' })} className="text-white/30 hover:text-white/60 p-1">✕</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs w-16">To:</span>
                    <input
                      value={draftForm.to}
                      onChange={e => setDraftForm(f => ({ ...f, to: e.target.value }))}
                      className="nexus-input flex-1 text-xs py-1.5"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs w-16">Subject:</span>
                    <input
                      value={draftForm.subject}
                      onChange={e => setDraftForm(f => ({ ...f, subject: e.target.value }))}
                      className="nexus-input flex-1 text-xs py-1.5"
                    />
                  </div>
                </div>
                <textarea
                  value={draftForm.body}
                  onChange={e => setDraftForm(f => ({ ...f, body: e.target.value }))}
                  rows={6}
                  className="nexus-input resize-none text-sm"
                />
                <p className="text-white/30 text-[10px]">
                  ⚠ Review before sending. This draft will be saved to Gmail — you must send it manually from Gmail.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center">
            <div className="text-center">
              <Mail size={40} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/35 text-sm">Select an email to read</p>
              <button onClick={summarizeEmails} disabled={summarizing} className="nexus-btn-primary text-sm mt-4 flex items-center gap-2 mx-auto">
                <Sparkles size={14} />
                {summarizing ? 'Summarizing...' : 'Summarize Inbox with AI'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
