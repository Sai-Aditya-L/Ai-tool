import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const topic = req.nextUrl.searchParams.get('topic')
  if (!topic) return NextResponse.json({ error: 'Missing topic' }, { status: 400 })

  try {
    // Try exact match first
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&srlimit=1`,
      { headers: { 'User-Agent': 'NEXUS-AI/1.0' } }
    )
    const searchData = await searchRes.json()
    const firstResult = searchData?.query?.search?.[0]
    const title = firstResult?.title || topic

    // Get summary
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { 'User-Agent': 'NEXUS-AI/1.0' } }
    )
    if (!res.ok) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    const data = await res.json()

    return NextResponse.json({
      title: data.title,
      summary: data.extract,
      url: data.content_urls?.desktop?.page,
      thumbnail: data.thumbnail?.source,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Wikipedia lookup failed' }, { status: 500 })
  }
}
