import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

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

const riskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.enum(['Technical', 'People', 'Process', 'External', 'Physical']).default('Technical'),
  likelihood: z.enum(['Critical', 'High', 'Medium', 'Low']).default('Medium'),
  impact: z.enum(['Critical', 'High', 'Medium', 'Low']).default('Medium'),
  status: z.enum(['open', 'mitigated', 'accepted', 'closed']).default('open'),
  owner: z.string().optional(),
  mitigation: z.string().optional(),
  framework: z.enum(['ISO27001', 'SOC2', 'NIST', 'AI_Gov', 'Custom']).optional(),
  controlRef: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const framework = searchParams.get('framework')
  const status = searchParams.get('status')
  const sort = searchParams.get('sort')

  const risks = await prisma.riskEntry.findMany({
    where: {
      userId: user.id,
      ...(framework && framework !== 'All' ? { framework } : {}),
      ...(status && status !== 'All' ? { status } : {}),
    },
    orderBy:
      sort === 'score'
        ? [{ riskScore: 'desc' }, { createdAt: 'desc' }]
        : sort === 'status'
        ? [{ status: 'asc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }],
  })

  return NextResponse.json({ risks })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const rl = rateLimit(`cybersecurity-risks:${user.id}`, 30, 60_000)
  if (!rl.success) return rateLimitResponse()

  try {
    const body = await req.json()
    const data = riskSchema.parse(body)

    const riskScore = calcRiskScore(data.likelihood, data.impact)

    const risk = await prisma.riskEntry.create({
      data: {
        userId: user.id,
        title: data.title,
        description: data.description,
        category: data.category,
        likelihood: data.likelihood,
        impact: data.impact,
        riskScore,
        status: data.status,
        owner: data.owner,
        mitigation: data.mitigation,
        framework: data.framework,
        controlRef: data.controlRef,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes,
      },
    })

    return NextResponse.json({ risk }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    console.error('Risk creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
