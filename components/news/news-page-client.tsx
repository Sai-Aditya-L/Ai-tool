'use client'

import { useState, useEffect } from 'react'
import { Newspaper, ExternalLink, RefreshCw, Search } from 'lucide-react'

interface Article {
  id: string
  title: string
  summary: string
  url: string
  source: string
  category: string
  publishedAt: string
}

export function NewsPageClient() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchNews = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/news?limit=50')
      const data = await res.json()
      if (data.articles) setArticles(data.articles)
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { fetchNews() }, [])

  const filtered = articles.filter(a => {
    const matchCat = category === 'all' || a.category === category
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.summary.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor(diff / 60000)
    if (h > 24) return `${Math.floor(h/24)}d ago`
    if (h > 0) return `${h}h ago`
    return `${m}m ago`
  }

  const categories = ['all', 'general', 'tech']

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="nexus-input pl-8 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          {categories.map(cat => (
            <button key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${category === cat ? 'bg-cyan-400/15 text-cyan-400 border border-cyan-400/30' : 'bg-white/5 text-white/50 border border-white/10 hover:text-white/80'}`}>
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
        <button onClick={() => fetchNews(true)}
          className="p-2 rounded-lg text-white/30 hover:text-cyan-400 hover:bg-cyan-400/5 transition-all border border-white/10">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="hud-panel hud-panel-inner rounded-xl p-5 animate-pulse">
              <div className="h-3 bg-white/10 rounded mb-3 w-3/4" />
              <div className="h-3 bg-white/5 rounded mb-2" />
              <div className="h-3 bg-white/5 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(article => (
            <a key={article.id} href={article.url} target="_blank" rel="noopener noreferrer"
              className="hud-panel hud-panel-inner rounded-xl p-5 hover:border-cyan-400/25 transition-all group block">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-white/85 text-sm font-medium leading-snug group-hover:text-white transition-colors line-clamp-3">
                  {article.title}
                </h3>
                <ExternalLink size={12} className="text-white/20 group-hover:text-cyan-400/60 flex-shrink-0 mt-0.5" />
              </div>
              {article.summary && (
                <p className="text-white/40 text-xs leading-relaxed mb-3 line-clamp-2">{article.summary}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="hud-label text-[9px]">{article.source}</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${article.category === 'tech' ? 'text-violet-400/70 bg-violet-400/10' : 'text-cyan-400/60 bg-cyan-400/8'}`}>
                    {article.category}
                  </span>
                </div>
                <span className="text-white/25 text-[9px]">{timeAgo(article.publishedAt)}</span>
              </div>
            </a>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-white/30">
              <Newspaper size={32} className="mx-auto mb-3 opacity-30" />
              <p>No articles found</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
