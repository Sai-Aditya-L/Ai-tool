import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const file = await prisma.userFile.findFirst({
    where: { id: params.id, userId: user.id },
  })

  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  return NextResponse.json({ file })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const file = await prisma.userFile.findFirst({
    where: { id: params.id, userId: user.id },
  })

  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  await prisma.userFile.delete({ where: { id: params.id } })

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'FILE_DELETED',
      entityType: 'file',
      entityId: params.id,
      details: `Deleted file: ${file.originalName}`,
    },
  })

  return NextResponse.json({ success: true })
}
