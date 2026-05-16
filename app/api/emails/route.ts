import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { listEmails, isGoogleConnected } from '@/lib/google'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const connected = await isGoogleConnected(user.id)
  if (!connected) {
    return NextResponse.json({
      connected: false,
      emails: [],
      message: 'Google account not connected. Connect Google in Integrations to sync Gmail.',
    })
  }

  const { searchParams } = new URL(req.url)
  const maxResults = parseInt(searchParams.get('maxResults') || '20')
  const query = searchParams.get('q') || ''
  const unreadOnly = searchParams.get('unreadOnly') === 'true'
  const refresh = searchParams.get('refresh') === 'true'
  const analyze = searchParams.get('analyze') === 'true'

  // --- Cache-first path ---
  // Only use cache when there's no search query and not an unread-only filter
  // (those filters require live data). Always bypass cache if ?refresh=true or ?analyze=true.
  const canUseCache = !refresh && !analyze && !query && !unreadOnly

  if (canUseCache) {
    const cached = await prisma.emailCache.findMany({
      where: { userId: user.id },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    })

    if (cached.length > 0) {
      const emails = cached.map(e => ({
        id: e.gmailId,
        threadId: e.threadId,
        from: e.from,
        fromName: e.fromName,
        to: e.to,
        subject: e.subject,
        snippet: e.snippet,
        body: e.body,
        summary: e.summary,
        labels: e.labels ? (() => { try { return JSON.parse(e.labels!) } catch { return [] } })() : [],
        isRead: e.isRead,
        isStarred: e.isStarred,
        isImportant: e.isImportant,
        receivedAt: e.receivedAt.toISOString(),
      }))

      return NextResponse.json({
        connected: true,
        emails,
        cacheHit: true,
      })
    }
  }

  // --- Live fetch path ---
  try {
    const result = await listEmails(user.id, {
      maxResults,
      query: unreadOnly ? `is:unread ${query}`.trim() : query,
      labelIds: ['INBOX'],
    })

    const emails = result.emails

    // Upsert fetched emails into cache (skip when query/unreadOnly filters are active
    // to avoid polluting the cache with partial result sets)
    if (emails && emails.length > 0 && !query && !unreadOnly) {
      await Promise.allSettled(
        (emails as any[]).map(e =>
          prisma.emailCache.upsert({
            where: { userId_gmailId: { userId: user.id, gmailId: e.id } },
            update: {
              threadId: e.threadId,
              from: e.from,
              fromName: e.fromName ?? null,
              to: e.to,
              subject: e.subject,
              snippet: e.snippet ?? null,
              body: e.body ?? null,
              summary: e.summary ?? null,
              labels: e.labels ? JSON.stringify(e.labels) : null,
              isRead: e.isRead,
              isStarred: e.isStarred,
              isImportant: e.isImportant,
              receivedAt: new Date(e.receivedAt),
            },
            create: {
              userId: user.id,
              gmailId: e.id,
              threadId: e.threadId,
              from: e.from,
              fromName: e.fromName ?? null,
              to: e.to,
              subject: e.subject,
              snippet: e.snippet ?? null,
              body: e.body ?? null,
              summary: e.summary ?? null,
              labels: e.labels ? JSON.stringify(e.labels) : null,
              isRead: e.isRead,
              isStarred: e.isStarred,
              isImportant: e.isImportant,
              receivedAt: new Date(e.receivedAt),
            },
          })
        )
      )
    }

    // Optional AI analysis step when ?analyze=true is set
    if (analyze && emails && emails.length > 0) {
      try {
        const unreadEmails = (emails as any[]).filter((e: any) => !e.isRead).slice(0, 5)
        const emailsToAnalyze = unreadEmails.length > 0 ? unreadEmails : (emails as any[]).slice(0, 5)

        const emailList = emailsToAnalyze
          .map((e: any, i: number) => `${i + 1}. Subject: ${e.subject}\n   From: ${e.from}\n   Snippet: ${e.snippet}`)
          .join('\n\n')

        const aiResponse = await anthropic.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          system: 'You are an intelligent email analyzer. Extract action items, deadlines, meetings, bills, and important follow-ups from these emails. Return a JSON array of { type: \'task\'|\'reminder\'|\'meeting\'|\'bill\', title: string, dueDate?: string, priority: \'high\'|\'medium\'|\'low\', emailSubject: string }. Return ONLY valid JSON.',
          messages: [{ role: 'user', content: `Analyze these emails and extract action items:\n\n${emailList}` }],
        })

        const textBlock = aiResponse.content.find(b => b.type === 'text')
        if (textBlock && textBlock.type === 'text') {
          const actionItems = JSON.parse(textBlock.text.trim())
          return NextResponse.json({
            connected: true,
            emails,
            nextPageToken: result.nextPageToken,
            actionItems,
            cacheHit: false,
          })
        }
      } catch {
        // If AI analysis or parsing fails, fall through and return emails without actionItems
      }
    }

    return NextResponse.json({
      connected: true,
      emails,
      nextPageToken: result.nextPageToken,
      cacheHit: false,
    })
  } catch (error: any) {
    if (error.message?.includes('invalid_grant') || error.message?.includes('Token')) {
      await prisma.integration.updateMany({
        where: { userId: user.id, provider: 'google' },
        data: { status: 'error' },
      })
      return NextResponse.json({ error: 'Google token expired. Please reconnect.', reconnect: true }, { status: 401 })
    }
    console.error('Gmail fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
  }
}
