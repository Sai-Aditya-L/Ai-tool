import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Parser from 'rss-parser'

const parser = new Parser({
  customFields: { item: ['media:thumbnail', 'media:content', 'enclosure'] },
})

const FEEDS = [
  { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'general' },
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews', category: 'general' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'tech' },
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'tech' },
  { name: 'The Guardian Tech', url: 'https://www.theguardian.com/technology/rss', category: 'tech' },
]

let cache: { articles: any[]; fetchedAt: number } | null = null
const CACHE_TTL = 15 * 60 * 1000 // 15 min

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const category = req.nextUrl.searchParams.get('category') || 'all'
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')

  // Return cache if fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    const articles = category === 'all' ? cache.articles : cache.articles.filter(a => a.category === category)
    return NextResponse.json({ articles: articles.slice(0, limit), cached: true })
  }

  try {
    const feedsToFetch = FEEDS
    const results = await Promise.allSettled(
      feedsToFetch.map(async (feed) => {
        try {
          const result = await Promise.race([
            parser.parseURL(feed.url),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
          ]) as any
          return (result.items || []).slice(0, 8).map((item: any) => ({
            id: item.guid || item.link || item.title,
            title: item.title?.replace(/<[^>]+>/g, '') || '',
            summary: (item.contentSnippet || item.summary || item.description || '')
              .replace(/<[^>]+>/g, '').slice(0, 200),
            url: item.link || '',
            source: feed.name,
            category: feed.category,
            publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
            thumbnail: item['media:thumbnail']?.$.url || item.enclosure?.url || null,
          }))
        } catch {
          return []
        }
      })
    )

    const articles = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => (r as PromiseFulfilledResult<any[]>).value)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    cache = { articles, fetchedAt: Date.now() }
    const filtered = category === 'all' ? articles : articles.filter(a => a.category === category)
    return NextResponse.json({ articles: filtered.slice(0, limit), cached: false })
  } catch (e) {
    return NextResponse.json({ error: 'News feed unavailable' }, { status: 500 })
  }
}
