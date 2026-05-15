import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const memorySchema = z.object({
  category: z.string(),
  key: z.string(),
  value: z.string(),
  source: z.string().default('user'),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  const memories = await prisma.memory.findMany({
    where: { userId: user.id, ...(category && { category }) },
    orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
  })

  return NextResponse.json({ memories })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = memorySchema.parse(body)

    const memory = await prisma.memory.upsert({
      where: { userId_key: { userId: user.id, key: data.key } },
      update: { value: data.value, category: data.category },
      create: { userId: user.id, ...data },
    })

    return NextResponse.json({ memory }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await prisma.memory.deleteMany({ where: { userId: user.id } })
  return NextResponse.json({ success: true, message: 'All memory cleared' })
}
