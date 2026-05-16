import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const webhooks = await prisma.webhookEndpoint.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ webhooks })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const testId = searchParams.get('test')

  // Handle test webhook
  if (testId) {
    try {
      const webhook = await prisma.webhookEndpoint.findFirst({
        where: { id: testId, userId: user.id },
      })
      if (!webhook) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })

      const payload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: { message: 'Test webhook from NEXUS' },
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-NEXUS-Event': 'test',
          ...(webhook.secret
            ? { 'X-NEXUS-Signature': crypto.createHmac('sha256', webhook.secret).update(JSON.stringify(payload)).digest('hex') }
            : {}),
        },
        body: JSON.stringify(payload),
      })

      await prisma.webhookEndpoint.update({
        where: { id: testId },
        data: { lastTriggeredAt: new Date() },
      })

      return NextResponse.json({ success: response.ok, status: response.status })
    } catch (error) {
      console.error('Test webhook error:', error)
      return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
  }

  // Create new webhook
  try {
    const body = await req.json()
    const { name, url, events } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    const secret = crypto.randomBytes(32).toString('hex')

    const webhook = await prisma.webhookEndpoint.create({
      data: {
        userId: user.id,
        name: name.trim(),
        url: url.trim(),
        events: Array.isArray(events) ? JSON.stringify(events) : '[]',
        secret,
      },
    })

    return NextResponse.json({ webhook }, { status: 201 })
  } catch (error) {
    console.error('POST /api/webhooks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await req.json()
    const { isActive } = body

    const webhook = await prisma.webhookEndpoint.findFirst({ where: { id, userId: user.id } })
    if (!webhook) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: { isActive: isActive !== undefined ? isActive : webhook.isActive },
    })

    return NextResponse.json({ webhook: updated })
  } catch (error) {
    console.error('PATCH /api/webhooks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const webhook = await prisma.webhookEndpoint.findFirst({ where: { id, userId: user.id } })
  if (!webhook) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })

  await prisma.webhookEndpoint.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
