import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const { action, ids } = body as { action: 'delete' | 'pin' | 'unpin'; ids: string[] }

  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  let affected = 0

  if (action === 'delete') {
    const result = await prisma.note.deleteMany({
      where: { id: { in: ids }, userId: user.id },
    })
    affected = result.count
  } else if (action === 'pin' || action === 'unpin') {
    const result = await prisma.note.updateMany({
      where: { id: { in: ids }, userId: user.id },
      data: { pinned: action === 'pin' },
    })
    affected = result.count
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  return NextResponse.json({ success: true, affected })
}
