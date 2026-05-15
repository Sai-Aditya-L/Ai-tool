'use client'

import { useState, useEffect } from 'react'
import { Newspaper, ExternalLink, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface Article {
  id: string
  title: string
  summary: string
  url: string
  source: string
  category: string
  publishedAt: string
}

export function NewsWidget() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<'all' | 'tech' | 'general'>('all')

  const fetchNews = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/news?limit=6')
      const data = await res.json()
      if (data.articles) setArticles(data.articles)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchNews() }, [])

  const filtered = activeCategory === 'all' ? articles : articles.filter(a => a.category === activeCategory)

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor(diff / 60000)
    if (h > 24) return `${Math.floor(h/24)}d ago`
    if (h > 0) return `${h}h ago`
    return `${m}m ago`
  }

  return (
    <div className="hud-panel hud-panel-inner rounded-xl p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-cyan-400/60" />
          <span className="hud-label text-xs">INTEL FEED</span>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'tech', 'general'] as const).map(cat => (
            <button key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-[10px] px-2 py-0.5 rounded transition-all ${activeCategory === cat ? 'bg-cyan-400/15 text-cyan-400 border border-cyan-400/30' : 'text-white/30 hover:text-white/60'}`}>
              {cat.toUpperCase()}
            </button>
          ))}
          <button onClick={fetchNews} className="text-white/20 hover:text-cyan-400 transition-colors ml-1">
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="hud-label text-xs">FETCHING FEEDS...</span>
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
          {filtered.slice(0, 6).map((article) => (
            <a key={article.id} href={article.url} target="_blank" rel="noopener noreferrer"
              className="block p-2.5 rounded-lg bg-white/3 hover:bg-cyan-400/5 border border-white/5 hover:border-cyan-400/15 transition-all group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-white/80 text-xs font-medium leading-snug group-hover:text-white line-clamp-2">
                  {article.title}
                </p>
                <ExternalLink size={10} className="text-white/20 group-hover:text-cyan-400/60 flex-shrink-0 mt-0.5" />
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="hud-label" style={{ fontSize: 8 }}>{article.source}</span>
                <span className="text-white/20 text-[9px]">•</span>
                <span className="text-white/25 text-[9px]">{timeAgo(article.publishedAt)}</span>
              </div>
            </a>
          ))}
        </div>
      )}

      <Link href="/news"
        className="mt-3 text-center text-xs text-cyan-400/50 hover:text-cyan-400 transition-colors pt-2 border-t border-cyan-400/10">
        VIEW ALL NEWS →
      </Link>
    </div>
  )
}
