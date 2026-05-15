import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const SCORE_MAP: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
}

function calcRiskScore(likelihood: string, impact: string): number {
  const l = SCORE_MAP[likelihood] ?? 2
  const i = SCORE_MAP[impact] ?? 2
  return l * i
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.enum(['Technical', 'People', 'Process', 'External', 'Physical']).optional(),
  likelihood: z.enum(['Critical', 'High', 'Medium', 'Low']).optional(),
  impact: z.enum(['Critical', 'High', 'Medium', 'Low']).optional(),
  status: z.enum(['open', 'mitigated', 'accepted', 'closed']).optional(),
  owner: z.string().optional(),
  mitigation: z.string().optional(),
  framework: z.enum(['ISO27001', 'SOC2', 'NIST', 'AI_Gov', 'Custom']).optional(),
  controlRef: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const risk = await prisma.riskEntry.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!risk) return NextResponse.json({ error: 'Risk not found' }, { status: 404 })

  return NextResponse.json({ risk })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existing = await prisma.riskEntry.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Risk not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const likelihood = data.likelihood ?? existing.likelihood
    const impact = data.impact ?? existing.impact
    const riskScore =
      data.likelihood || data.impact ? calcRiskScore(likelihood, impact) : undefined

    const updated = await prisma.riskEntry.update({
      where: { id: params.id },
      data: {
        ...data,
        ...(riskScore !== undefined ? { riskScore } : {}),
        dueDate:
          data.dueDate === null
            ? null
            : data.dueDate
            ? new Date(data.dueDate)
            : undefined,
      },
    })

    return NextResponse.json({ risk: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    console.error('Risk update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existing = await prisma.riskEntry.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Risk not found' }, { status: 404 })

  await prisma.riskEntry.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
