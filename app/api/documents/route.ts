import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const documents = await prisma.userFile.findMany({
    where: {
      userId: user.id,
      NOT: { mimeType: { startsWith: 'image/' } },
      ...(q ? { OR: [{ originalName: { contains: q } }, { analysis: { contains: q } }, { tags: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, originalName: true, mimeType: true, size: true, analysis: true, tags: true, createdAt: true },
    take: 50,
  })
  return NextResponse.json({ documents })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const doc = await prisma.userFile.findFirst({ where: { id, userId: user.id } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.userFile.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
