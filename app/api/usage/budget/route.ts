import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const DEFAULT_MONTHLY_BUDGET = 10 // USD

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Get monthly budget from memory store (key: ai_monthly_budget)
  const budgetMemory = await prisma.memory.findFirst({
    where: { userId: user.id, key: 'ai_monthly_budget' },
  })
  const monthlyBudget = budgetMemory ? parseFloat(budgetMemory.value) : DEFAULT_MONTHLY_BUDGET

  // Calculate current month cost
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const usageThisMonth = await prisma.aIUsage.aggregate({
    where: {
      userId: user.id,
      createdAt: { gte: startOfMonth },
    },
    _sum: { estimatedCost: true },
  })

  const currentMonthCost = usageThisMonth._sum.estimatedCost ?? 0
  const percentUsed = monthlyBudget > 0 ? (currentMonthCost / monthlyBudget) * 100 : 0
  const warning = percentUsed >= 80

  return NextResponse.json({
    monthlyBudget,
    currentMonthCost,
    percentUsed,
    warning,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const body = await req.json()
  const { monthlyBudget } = body

  if (typeof monthlyBudget !== 'number' || monthlyBudget < 0) {
    return NextResponse.json({ error: 'Invalid monthlyBudget' }, { status: 400 })
  }

  // Store budget in Memory model using key 'ai_monthly_budget'
  await prisma.memory.upsert({
    where: { userId_key: { userId: user.id, key: 'ai_monthly_budget' } },
    update: { value: monthlyBudget.toString() },
    create: {
      userId: user.id,
      category: 'system',
      key: 'ai_monthly_budget',
      value: monthlyBudget.toString(),
      source: 'system',
    },
  })

  return NextResponse.json({ success: true, monthlyBudget })
}
