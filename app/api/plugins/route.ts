import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const plugins = await prisma.plugin.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ plugins })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const { name, description, toolName, config, permissions } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!toolName || typeof toolName !== 'string' || toolName.trim().length === 0) {
      return NextResponse.json({ error: 'toolName is required' }, { status: 400 })
    }

    const existing = await prisma.plugin.findUnique({
      where: { userId_toolName: { userId: user.id, toolName: toolName.trim() } },
    })
    if (existing) {
      return NextResponse.json({ error: 'A plugin with this tool name already exists' }, { status: 409 })
    }

    const plugin = await prisma.plugin.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: description || null,
        toolName: toolName.trim(),
        config: config ? JSON.stringify(config) : '{}',
        permissions: Array.isArray(permissions) ? JSON.stringify(permissions) : '[]',
      },
    })

    return NextResponse.json({ plugin }, { status: 201 })
  } catch (error) {
    console.error('POST /api/plugins error:', error)
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

    const plugin = await prisma.plugin.findFirst({ where: { id, userId: user.id } })
    if (!plugin) return NextResponse.json({ error: 'Plugin not found' }, { status: 404 })

    const updated = await prisma.plugin.update({
      where: { id },
      data: { isActive: isActive !== undefined ? isActive : plugin.isActive },
    })

    return NextResponse.json({ plugin: updated })
  } catch (error) {
    console.error('PATCH /api/plugins error:', error)
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

  const plugin = await prisma.plugin.findFirst({ where: { id, userId: user.id } })
  if (!plugin) return NextResponse.json({ error: 'Plugin not found' }, { status: 404 })

  await prisma.plugin.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
