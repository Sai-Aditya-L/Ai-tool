import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const bulkSchema = z.object({
  action: z.enum(['complete', 'delete']),
  ids: z.array(z.string().min(1).max(500)).min(1).max(100),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const parse = bulkSchema.safeParse(await req.json())
  if (!parse.success) return NextResponse.json({ error: 'Invalid input', details: parse.error.flatten() }, { status: 400 })
  const { action, ids } = parse.data

  let affected = 0

  if (action === 'complete') {
    const result = await prisma.task.updateMany({
      where: { id: { in: ids }, userId: user.id },
      data: { status: 'completed', completedAt: new Date() },
    })
    affected = result.count
  } else if (action === 'delete') {
    const result = await prisma.task.deleteMany({
      where: { id: { in: ids }, userId: user.id },
    })
    affected = result.count
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  return NextResponse.json({ success: true, affected })
}
