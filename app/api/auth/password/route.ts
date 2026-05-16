import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user?.hashedPassword) {
    return NextResponse.json({ error: 'Password change not available for OAuth accounts' }, { status: 400 })
  }

  const body = await req.json()
  const parse = schema.safeParse(body)
  if (!parse.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { currentPassword, newPassword } = parse.data
  const valid = await bcrypt.compare(currentPassword, user.hashedPassword)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: user.id }, data: { hashedPassword: hashed } })

  await prisma.activityLog.create({
    data: { userId: user.id, action: 'password_changed', entityType: 'user', entityId: user.id, metadata: '{}' },
  })

  return NextResponse.json({ success: true })
}
