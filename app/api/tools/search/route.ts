import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  const num = parseInt(req.nextUrl.searchParams.get('num') || '5')
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 })

  // Try Brave Search API first
  const braveKey = process.env.BRAVE_SEARCH_API_KEY
  if (braveKey) {
    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(num, 10)}`,
        { headers: { 'X-Subscription-Token': braveKey, 'Accept': 'application/json' } }
      )
      if (res.ok) {
        const data = await res.json()
        const results = (data.web?.results || []).slice(0, num).map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.description,
        }))
        return NextResponse.json({ results, source: 'brave' })
      }
    } catch {}
  }

  // Try Serper (Google results)
  const serperKey = process.env.SERPER_API_KEY
  if (serperKey) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: Math.min(num, 10) }),
      })
      if (res.ok) {
        const data = await res.json()
        const results = (data.organic || []).slice(0, num).map((r: any) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
        }))
        return NextResponse.json({ results, source: 'serper' })
      }
    } catch {}
  }

  // Fallback: DuckDuckGo Instant Answer API
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (res.ok) {
      const data = await res.json()
      const results: Array<{ title: string; url: string; snippet: string }> = []
      if (data.AbstractText) {
        results.push({ title: data.Heading || query, url: data.AbstractURL || '', snippet: data.AbstractText })
      }
      for (const topic of (data.RelatedTopics || []).slice(0, num - 1)) {
        if (topic.Text && topic.FirstURL) {
          results.push({ title: topic.Text.split(' - ')[0] || query, url: topic.FirstURL, snippet: topic.Text })
        }
      }
      return NextResponse.json({ results: results.slice(0, num), source: 'duckduckgo' })
    }
  } catch {}

  return NextResponse.json({ results: [], error: 'Search unavailable. Configure BRAVE_SEARCH_API_KEY or SERPER_API_KEY in .env for full web search.' })
}
