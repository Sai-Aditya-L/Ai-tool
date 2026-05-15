'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { formatRelativeTime } from '@/lib/utils'
import { Sparkles, Calendar, ChevronDown, ChevronUp, RotateCcw, Loader2 } from 'lucide-react'

interface DailySummary {
  id: string
  userId: string
  date: string
  content: string
  type: 'daily' | 'weekly'
  createdAt: string
}

function formatContent(content: string) {
  const lines = content.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <h2 key={i} className="text-cyan-400 font-semibold text-base mt-4 mb-2 first:mt-0">
          {line.replace('## ', '')}
        </h2>
      )
    }
    if (line.startsWith('# ')) {
      return (
        <h1 key={i} className="text-cyan-400 font-bold text-lg mt-4 mb-2 first:mt-0">
          {line.replace('# ', '')}
        </h1>
      )
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const text = line.replace(/^[-*] /, '')
      return (
        <li key={i} className="text-white/70 text-sm ml-4 mb-1 list-disc">
          {renderInline(text)}
        </li>
      )
    }
    if (line.trim() === '') {
      return <br key={i} />
    }
    return (
      <p key={i} className="text-white/70 text-sm mb-1">
        {renderInline(line)}
      </p>
    )
  })
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export default function DailySummariesPage() {
  const [summaries, setSummaries] = useState<DailySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const fetchSummaries = useCallback(async () => {
    try {
      const res = await fetch('/api/daily-summaries')
      if (res.ok) {
        const data = await res.json()
        setSummaries(data.summaries)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummaries()
  }, [fetchSummaries])

  async function generateSummary(type: 'daily' | 'weekly' = 'daily') {
    setGenerating(true)
    try {
      const res = await fetch('/api/daily-summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (res.ok) {
        const data = await res.json()
        setSummaries(prev => {
          const filtered = prev.filter(s => s.id !== data.summary.id)
          return [data.summary, ...filtered]
        })
      }
    } finally {
      setGenerating(false)
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(Array.from(prev))
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const today = new Date().toISOString().split('T')[0]
  const todaySummary = summaries.find(s => s.date === today)
  const pastSummaries = summaries.filter(s => s.date !== today)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Daily Summaries" subtitle="AI-generated briefings" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Action bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => generateSummary('daily')}
              disabled={generating}
              className="nexus-btn-primary flex items-center gap-2 text-sm"
            >
              {generating
                ? <Loader2 size={15} className="animate-spin" />
                : <Sparkles size={15} />
              }
              {generating ? 'Generating...' : 'Generate Today\'s Briefing'}
            </button>
            <button
              onClick={() => generateSummary('weekly')}
              disabled={generating}
              className="nexus-btn-secondary flex items-center gap-2 text-sm"
            >
              <Calendar size={15} />
              Weekly Review
            </button>
          </div>

          {/* Generating state */}
          {generating && (
            <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-cyan-400" />
              <p className="text-white/50 text-sm">NEXUS is generating your briefing...</p>
            </div>
          )}

          {/* Loading state */}
          {loading && !generating && (
            <div className="glass-panel rounded-2xl p-8 flex justify-center">
              <Loader2 size={24} className="animate-spin text-white/30" />
            </div>
          )}

          {/* Today's summary — featured card */}
          {!loading && todaySummary && (
            <div className="glass-panel rounded-2xl p-6 border border-cyan-400/20">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-400/10 flex items-center justify-center">
                    <Sparkles size={18} className="text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-base">Today's Briefing</h2>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Calendar size={11} className="text-cyan-400/60" />
                      <span className="text-cyan-400/60 text-xs">
                        {new Date(todaySummary.date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'long', month: 'long', day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => generateSummary('daily')}
                  disabled={generating}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-cyan-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-cyan-400/5 border border-transparent hover:border-cyan-400/20 disabled:opacity-40"
                >
                  <RotateCcw size={12} />
                  Regenerate
                </button>
              </div>
              <div className="prose-like">
                {formatContent(todaySummary.content)}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 text-white/25 text-xs">
                <Calendar size={11} />
                <span>Generated {formatRelativeTime(todaySummary.createdAt)}</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !generating && summaries.length === 0 && (
            <div className="glass-panel rounded-2xl p-12 text-center">
              <Sparkles size={36} className="text-white/10 mx-auto mb-4" />
              <p className="text-white/40 text-sm">No briefings yet.</p>
              <p className="text-white/25 text-xs mt-1">Generate your first daily summary above.</p>
            </div>
          )}

          {/* Past summaries */}
          {!loading && pastSummaries.length > 0 && (
            <div>
              <p className="text-white/30 text-xs uppercase tracking-wider mb-3">Past Briefings</p>
              <div className="space-y-3">
                {pastSummaries.map(summary => {
                  const expanded = expandedIds.has(summary.id)
                  return (
                    <div key={summary.id} className="glass-panel-hover rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleExpand(summary.id)}
                        className="w-full text-left p-4 flex items-start gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Calendar size={14} className="text-white/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/70 text-sm font-medium">
                            {new Date(summary.date + 'T00:00:00').toLocaleDateString('en-US', {
                              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </p>
                          {!expanded && (
                            <p className="text-white/35 text-xs mt-1 line-clamp-2">
                              {summary.content.replace(/#{1,3} /g, '').replace(/\*\*/g, '').slice(0, 150)}
                              {summary.content.length > 150 && '...'}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-white/30 mt-1">
                          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-4 pb-4 border-t border-white/5 pt-3">
                          {formatContent(summary.content)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
