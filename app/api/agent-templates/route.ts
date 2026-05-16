import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const templates = await prisma.agentTemplate.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const deployId = searchParams.get('deploy')

  // Deploy agent from template
  if (deployId) {
    try {
      const template = await prisma.agentTemplate.findFirst({
        where: { id: deployId, userId: user.id },
      })
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

      const agent = await prisma.agent.create({
        data: {
          userId: user.id,
          name: template.name,
          role: template.role,
          systemPrompt: template.systemPrompt,
          status: 'idle',
        },
      })

      return NextResponse.json({ agent })
    } catch (error) {
      console.error('Deploy agent template error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  // Create new template
  try {
    const body = await req.json()
    const { name, role, description, systemPrompt, tools } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!role || typeof role !== 'string' || role.trim().length === 0) {
      return NextResponse.json({ error: 'role is required' }, { status: 400 })
    }
    if (!systemPrompt || typeof systemPrompt !== 'string' || systemPrompt.trim().length === 0) {
      return NextResponse.json({ error: 'systemPrompt is required' }, { status: 400 })
    }

    const template = await prisma.agentTemplate.create({
      data: {
        userId: user.id,
        name: name.trim(),
        role: role.trim(),
        description: description || null,
        systemPrompt: systemPrompt.trim(),
        tools: Array.isArray(tools) ? JSON.stringify(tools) : (typeof tools === 'string' ? tools : '[]'),
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('POST /api/agent-templates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const body = await req.json()
    const { name, role, description, systemPrompt, tools } = body

    const existing = await prisma.agentTemplate.findFirst({ where: { id, userId: user.id } })
    if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const updated = await prisma.agentTemplate.update({
      where: { id },
      data: {
        name: name ? name.trim() : existing.name,
        role: role ? role.trim() : existing.role,
        description: description !== undefined ? description : existing.description,
        systemPrompt: systemPrompt ? systemPrompt.trim() : existing.systemPrompt,
        tools: tools !== undefined
          ? (Array.isArray(tools) ? JSON.stringify(tools) : (typeof tools === 'string' ? tools : existing.tools))
          : existing.tools,
      },
    })

    return NextResponse.json({ template: updated })
  } catch (error) {
    console.error('PUT /api/agent-templates error:', error)
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

  const template = await prisma.agentTemplate.findFirst({ where: { id, userId: user.id } })
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  await prisma.agentTemplate.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
