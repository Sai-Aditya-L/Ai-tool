import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const note = await prisma.note.findFirst({ where: { id: params.id, userId: user.id } })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await prisma.note.update({ where: { id: params.id }, data: body })
  return NextResponse.json({ note: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const note = await prisma.note.findFirst({ where: { id: params.id, userId: user.id } })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.note.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
