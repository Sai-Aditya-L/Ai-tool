import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const templates = await prisma.workflowTemplate.findMany({
    where: {
      OR: [{ userId: user.id }, { isPublic: true }],
    },
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
  const useId = searchParams.get('use')

  // Use a workflow template
  if (useId) {
    try {
      const template = await prisma.workflowTemplate.findFirst({
        where: {
          id: useId,
          OR: [{ userId: user.id }, { isPublic: true }],
        },
      })
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

      await prisma.workflowTemplate.update({
        where: { id: useId },
        data: { useCount: { increment: 1 } },
      })

      return NextResponse.json({ steps: JSON.parse(template.steps), template })
    } catch (error) {
      console.error('Use workflow template error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  // Create new template
  try {
    const body = await req.json()
    const { name, description, steps, trigger } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const template = await prisma.workflowTemplate.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: description || null,
        steps: Array.isArray(steps) ? JSON.stringify(steps) : '[]',
        trigger: trigger || null,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('POST /api/workflow-templates error:', error)
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
    const { name, description, steps, trigger, isPublic } = body

    const existing = await prisma.workflowTemplate.findFirst({ where: { id, userId: user.id } })
    if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const updated = await prisma.workflowTemplate.update({
      where: { id },
      data: {
        name: name ? name.trim() : existing.name,
        description: description !== undefined ? description : existing.description,
        steps: steps !== undefined
          ? (Array.isArray(steps) ? JSON.stringify(steps) : existing.steps)
          : existing.steps,
        trigger: trigger !== undefined ? trigger : existing.trigger,
        isPublic: isPublic !== undefined ? isPublic : existing.isPublic,
      },
    })

    return NextResponse.json({ template: updated })
  } catch (error) {
    console.error('PUT /api/workflow-templates error:', error)
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

  const template = await prisma.workflowTemplate.findFirst({ where: { id, userId: user.id } })
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  await prisma.workflowTemplate.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
