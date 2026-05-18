import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const shortcut = await prisma.shortcut.findFirst({ where: { id: params.id, userId: user.id } })
  if (!shortcut) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Increment useCount on trigger
  if (body.increment) {
    const updated = await prisma.shortcut.update({ where: { id: params.id }, data: { useCount: { increment: 1 } } })
    return NextResponse.json({ shortcut: updated })
  }
  const updated = await prisma.shortcut.update({
    where: { id: params.id },
    data: {
      trigger: body.trigger?.trim().toLowerCase() ?? shortcut.trigger,
      expansion: body.expansion?.trim() ?? shortcut.expansion,
      description: body.description?.trim() ?? shortcut.description,
    },
  })
  return NextResponse.json({ shortcut: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shortcut = await prisma.shortcut.findFirst({ where: { id: params.id, userId: user.id } })
  if (!shortcut) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.shortcut.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
