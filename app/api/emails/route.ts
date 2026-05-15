import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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

    return NextResponse.json({
      connected: true,
      emails: result.emails,
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
