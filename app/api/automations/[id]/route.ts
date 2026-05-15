import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  trigger: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  status: z.enum(['active', 'paused']).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existing = await prisma.automation.findFirst({ where: { id: params.id, userId: user.id } })
  if (!existing) return NextResponse.json({ error: 'Automation not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const automation = await prisma.automation.update({
      where: { id: params.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.trigger && { trigger: data.trigger }),
        ...(data.action && { actions: data.action }),
        ...(data.status && { status: data.status }),
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'AUTOMATION_UPDATED',
        entityType: 'automation',
        entityId: automation.id,
        details: `Updated automation: ${automation.name}${data.status ? ` → ${data.status}` : ''}`,
      },
    })

    return NextResponse.json({ automation })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existing = await prisma.automation.findFirst({ where: { id: params.id, userId: user.id } })
  if (!existing) return NextResponse.json({ error: 'Automation not found' }, { status: 404 })

  await prisma.automation.delete({ where: { id: params.id } })

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'AUTOMATION_DELETED',
      entityType: 'automation',
      entityId: params.id,
      details: `Deleted automation: ${existing.name}`,
    },
  })

  return NextResponse.json({ success: true })
}
