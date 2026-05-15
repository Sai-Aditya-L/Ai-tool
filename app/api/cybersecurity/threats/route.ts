import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const threatSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  system: z.string().optional(),
  methodology: z.enum(['STRIDE', 'DREAD', 'PASTA', 'Custom']).default('STRIDE'),
  threats: z.string().optional(),
  mitigations: z.string().optional(),
  status: z.enum(['draft', 'in_review', 'approved', 'archived']).default('draft'),
})

const updateSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  system: z.string().optional(),
  methodology: z.enum(['STRIDE', 'DREAD', 'PASTA', 'Custom']).optional(),
  threats: z.string().optional(),
  mitigations: z.string().optional(),
  status: z.enum(['draft', 'in_review', 'approved', 'archived']).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const methodology = searchParams.get('methodology')
  const status = searchParams.get('status')

  const threats = await prisma.threatModel.findMany({
    where: {
      userId: user.id,
      ...(methodology ? { methodology } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ threats })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const rl = rateLimit(`cybersecurity-threats:${user.id}`, 20, 60_000)
  if (!rl.success) return rateLimitResponse()

  try {
    const body = await req.json()

    // Handle PATCH (update) and DELETE embedded in POST for simplicity
    if (body._method === 'PATCH') {
      const data = updateSchema.parse(body)
      const existing = await prisma.threatModel.findFirst({
        where: { id: data.id, userId: user.id },
      })
      if (!existing) return NextResponse.json({ error: 'Threat model not found' }, { status: 404 })

      const { id, ...rest } = data
      const updated = await prisma.threatModel.update({
        where: { id },
        data: rest,
      })
      return NextResponse.json({ threat: updated })
    }

    if (body._method === 'DELETE') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
      const existing = await prisma.threatModel.findFirst({
        where: { id, userId: user.id },
      })
      if (!existing) return NextResponse.json({ error: 'Threat model not found' }, { status: 404 })
      await prisma.threatModel.delete({ where: { id } })
      return NextResponse.json({ success: true })
    }

    const data = threatSchema.parse(body)
    const threat = await prisma.threatModel.create({
      data: {
        userId: user.id,
        title: data.title,
        description: data.description,
        system: data.system,
        methodology: data.methodology,
        threats: data.threats,
        mitigations: data.mitigations,
        status: data.status,
      },
    })

    return NextResponse.json({ threat }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    console.error('Threat model error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const existing = await prisma.threatModel.findFirst({
      where: { id: data.id, userId: user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Threat model not found' }, { status: 404 })

    const { id, ...rest } = data
    const updated = await prisma.threatModel.update({
      where: { id },
      data: rest,
    })

    return NextResponse.json({ threat: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    console.error('Threat model update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const existing = await prisma.threatModel.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Threat model not found' }, { status: 404 })

    await prisma.threatModel.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Threat model delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
