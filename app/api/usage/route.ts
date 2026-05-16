import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { estimateCost } from '@/lib/model-router'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Fetch all usage for the user
  const allUsage = await prisma.aIUsage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  // Totals
  const totalRequests = allUsage.length
  const totalInputTokens = allUsage.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutputTokens = allUsage.reduce((s, r) => s + r.outputTokens, 0)
  const totalCost = allUsage.reduce((s, r) => s + r.estimatedCost, 0)

  // By model
  const modelMap = new Map<string, { requests: number; inputTokens: number; outputTokens: number; cost: number }>()
  for (const r of allUsage) {
    const entry = modelMap.get(r.model) ?? { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 }
    entry.requests++
    entry.inputTokens += r.inputTokens
    entry.outputTokens += r.outputTokens
    entry.cost += r.estimatedCost
    modelMap.set(r.model, entry)
  }
  const byModel = Array.from(modelMap.entries()).map(([model, data]) => ({ model, ...data }))

  // By feature
  const featureMap = new Map<string, { requests: number; cost: number }>()
  for (const r of allUsage) {
    const key = r.feature ?? 'unknown'
    const entry = featureMap.get(key) ?? { requests: 0, cost: 0 }
    entry.requests++
    entry.cost += r.estimatedCost
    featureMap.set(key, entry)
  }
  const byFeature = Array.from(featureMap.entries()).map(([feature, data]) => ({ feature, ...data }))

  // By day (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentForDay = allUsage.filter(r => r.createdAt >= thirtyDaysAgo)
  const dayMap = new Map<string, { requests: number; cost: number }>()
  for (const r of recentForDay) {
    const date = r.createdAt.toISOString().split('T')[0]
    const entry = dayMap.get(date) ?? { requests: 0, cost: 0 }
    entry.requests++
    entry.cost += r.estimatedCost
    dayMap.set(date, entry)
  }
  const byDay = Array.from(dayMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Recent 20
  const recent = allUsage.slice(0, 20)

  return NextResponse.json({
    totalRequests,
    totalInputTokens,
    totalOutputTokens,
    totalCost,
    byModel,
    byFeature,
    byDay,
    recent,
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
  const { model, inputTokens = 0, outputTokens = 0, taskType, feature } = body

  if (!model) {
    return NextResponse.json({ error: 'model is required' }, { status: 400 })
  }

  const cost = estimateCost(model, inputTokens, outputTokens)

  await prisma.aIUsage.create({
    data: {
      userId: user.id,
      model,
      inputTokens,
      outputTokens,
      estimatedCost: cost,
      taskType: taskType ?? null,
      feature: feature ?? null,
    },
  })

  return NextResponse.json({ success: true })
}
