import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const prefs = await prisma.userPreferences.findUnique({ where: { userId: user.id } })
  return NextResponse.json({ mode: prefs?.currentMode || 'personal' })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { mode } = await req.json()
  const validModes = ['personal', 'work', 'coding', 'security', 'research', 'focus', 'travel', 'meeting']
  if (!validModes.includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })

  await prisma.userPreferences.upsert({
    where: { userId: user.id },
    update: { currentMode: mode },
    create: { userId: user.id, currentMode: mode },
  })

  return NextResponse.json({ mode })
}
