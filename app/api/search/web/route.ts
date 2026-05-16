import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { searchWeb } from '@/lib/web-search'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const rl = rateLimit(`web_search:${user.id}`, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  const max = parseInt(searchParams.get('max') || '5', 10)

  if (!query) return NextResponse.json({ error: 'Missing query parameter ?q=' }, { status: 400 })

  const results = await searchWeb(query, Math.min(max, 10))

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'web_search',
      entityType: 'search',
      details: `Web search: "${query}" — ${results.length} results`,
    },
  })

  return NextResponse.json({ results, query, timestamp: new Date().toISOString() })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const rl = rateLimit(`web_search:${user.id}`, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  let body: { query?: string; maxResults?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { query, maxResults = 5 } = body
  if (!query) return NextResponse.json({ error: 'Missing query in request body' }, { status: 400 })

  const results = await searchWeb(query, Math.min(maxResults, 10))

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'web_search',
      entityType: 'search',
      details: `Web search: "${query}" — ${results.length} results`,
    },
  })

  return NextResponse.json({ results, query, timestamp: new Date().toISOString() })
}
