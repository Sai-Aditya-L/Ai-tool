import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shortcuts = await prisma.shortcut.findMany({
    where: { userId: user.id },
    orderBy: [{ useCount: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({ shortcuts })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = await rateLimit(`shortcuts:${session.user.email}`, 30, 60000)
  if (!limited.allowed) return rateLimitResponse()
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { trigger, expansion, description } = body as { trigger?: string; expansion?: string; description?: string }
  if (!trigger?.trim() || !expansion?.trim()) return NextResponse.json({ error: 'trigger and expansion required' }, { status: 400 })
  const shortcut = await prisma.shortcut.upsert({
    where: { userId_trigger: { userId: user.id, trigger: trigger.trim().toLowerCase() } },
    create: { userId: user.id, trigger: trigger.trim().toLowerCase(), expansion: expansion.trim(), description: description?.trim() },
    update: { expansion: expansion.trim(), description: description?.trim() },
  })
  return NextResponse.json({ shortcut }, { status: 201 })
}
