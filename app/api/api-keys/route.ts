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

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      permissions: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ keys })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const { name, permissions, expiresInDays } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const raw = 'nxs_' + crypto.randomBytes(32).toString('hex')
    const keyHash = crypto.createHash('sha256').update(raw).digest('hex')
    const prefix = raw.slice(0, 12)

    let expiresAt: Date | null = null
    if (expiresInDays && typeof expiresInDays === 'number' && expiresInDays > 0) {
      expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: name.trim(),
        keyHash,
        prefix,
        permissions: permissions || 'read',
        expiresAt,
      },
    })

    return NextResponse.json({
      key: raw,
      prefix,
      id: apiKey.id,
      name: apiKey.name,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/api-keys error:', error)
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

  const apiKey = await prisma.apiKey.findFirst({ where: { id, userId: user.id } })
  if (!apiKey) return NextResponse.json({ error: 'API key not found' }, { status: 404 })

  await prisma.apiKey.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
