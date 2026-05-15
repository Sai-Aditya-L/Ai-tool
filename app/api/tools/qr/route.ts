import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import QRCode from 'qrcode'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { text, size = 300, errorLevel = 'M', darkColor = '#00e5ff', lightColor = '#000810' } = body

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: 'text too long (max 2000 chars)' }, { status: 400 })
  }

  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width: Math.min(Math.max(size, 100), 800),
      errorCorrectionLevel: errorLevel as 'L' | 'M' | 'Q' | 'H',
      color: { dark: darkColor, light: lightColor },
      margin: 2,
    })
    return NextResponse.json({ dataUrl, text, size })
  } catch (e) {
    return NextResponse.json({ error: 'QR generation failed' }, { status: 500 })
  }
}
