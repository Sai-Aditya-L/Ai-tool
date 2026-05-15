import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEmailBody, markEmailRead, createDraft } from '@/lib/google'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await getEmailBody(user.id, params.id)
    await markEmailRead(user.id, params.id)
    return NextResponse.json({ body })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch email' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { to, subject, body, action } = await req.json()

  if (action === 'draft') {
    try {
      const draft = await createDraft(user.id, { to, subject, body, replyToMessageId: params.id })

      const savedDraft = await prisma.emailDraft.create({
        data: { userId: user.id, to, subject, body, replyToId: params.id },
      })

      await prisma.activityLog.create({
        data: { userId: user.id, action: 'EMAIL_DRAFTED', details: `Drafted reply to: ${subject}` },
      })

      return NextResponse.json({ success: true, draftId: draft.id, localDraftId: savedDraft.id })
    } catch (error) {
      return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
