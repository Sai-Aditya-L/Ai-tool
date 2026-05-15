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

  try {
    const result = await listEmails(user.id, {
      maxResults,
      query: unreadOnly ? `is:unread ${query}`.trim() : query,
      labelIds: ['INBOX'],
    })

    const emails = result.emails

    // Optional AI analysis step when ?analyze=true is set
    if (searchParams.get('analyze') === 'true' && emails && emails.length > 0) {
      try {
        const unreadEmails = emails.filter((e: any) => !e.isRead).slice(0, 5)
        const emailsToAnalyze = unreadEmails.length > 0 ? unreadEmails : emails.slice(0, 5)

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
