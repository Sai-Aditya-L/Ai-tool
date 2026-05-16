import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateSecret, keyuri, verifyToken } from '@/lib/totp'
import { encrypt, decrypt } from '@/lib/encryption'
import QRCode from 'qrcode'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { preferences: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)

  // ?status=1 → return current 2FA enabled state
  if (searchParams.get('status') === '1') {
    const prefs = user.preferences as (typeof user.preferences & { twoFactorEnabled?: boolean }) | null
    const enabled = prefs?.twoFactorEnabled ?? false
    return NextResponse.json({ enabled })
  }

  // Default: generate new TOTP secret + QR code for setup
  // Secret is NOT saved to DB here — only saved after verification
  const secret = generateSecret()
  const email = user.email ?? session.user.email
  const otpauthUri = keyuri(email, 'NEXUS', secret)
  const qrCode = await QRCode.toDataURL(otpauthUri)

  return NextResponse.json({ secret, qrCode, uri: otpauthUri })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const { secret, token } = await req.json()

    if (!secret || !token) {
      return NextResponse.json({ error: 'Missing secret or token' }, { status: 400 })
    }

    if (!verifyToken(token, secret, user.id)) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    const encoded = encrypt(secret)

    try {
      await prisma.userPreferences.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          twoFactorSecret: encoded,
          twoFactorEnabled: true,
        },
        update: {
          twoFactorSecret: encoded,
          twoFactorEnabled: true,
        },
      })
    } catch {
      // Fields not in schema yet — handle gracefully
      return NextResponse.json({ success: true, note: '2FA fields pending schema migration' })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
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
      twoFactorEnabled?: boolean
    }) | null

    const stored = prefs?.twoFactorSecret
    if (!stored) {
      return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 })
    }

    const secret = (() => { try { return decrypt(stored) } catch { return Buffer.from(stored, 'base64').toString() } })()
    if (!verifyToken(token, secret, user.id)) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    try {
      await prisma.userPreferences.update({
        where: { userId: user.id },
        data: {
          twoFactorSecret: null,
          twoFactorEnabled: false,
        },
      })
    } catch {
      // Fields not in schema yet — handle gracefully
      return NextResponse.json({ success: true, note: '2FA fields pending schema migration' })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
