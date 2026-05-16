import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { authenticator } from 'otplib'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { preferences: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const prefs = user.preferences as (typeof user.preferences & {
      twoFactorSecret?: string
    }) | null

    const stored = prefs?.twoFactorSecret
    if (!stored) {
      return NextResponse.json({ valid: false, error: '2FA not configured' }, { status: 400 })
    }

    const secret = Buffer.from(stored, 'base64').toString()
    const valid = authenticator.verify({ token, secret })

    return NextResponse.json({ valid })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
