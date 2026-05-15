import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function getHAConfig(userId: string): Promise<{ url: string; token: string } | null> {
  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'homeassistant' } },
  })
  if (!integration || integration.status !== 'connected' || !integration.metadata) return null
  try {
    return JSON.parse(integration.metadata) as { url: string; token: string }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'states'

  const ha = await getHAConfig(user.id)
  if (!ha) return NextResponse.json({ connected: false })

  try {
    const res = await fetch(`${ha.url}/api/states`, {
      headers: { Authorization: `Bearer ${ha.token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return NextResponse.json({ connected: false, error: 'HA unreachable' })

    const states: { entity_id: string; state: string; attributes: Record<string, unknown> }[] = await res.json()

    if (action === 'lights') {
      const lights = states.filter(s => s.entity_id.startsWith('light.'))
      return NextResponse.json({ connected: true, entities: lights })
    }
    if (action === 'switches') {
      const switches = states.filter(s => s.entity_id.startsWith('switch.'))
      return NextResponse.json({ connected: true, entities: switches })
    }

    const relevant = states.filter(s =>
      s.entity_id.startsWith('light.') ||
      s.entity_id.startsWith('switch.') ||
      s.entity_id.startsWith('climate.') ||
      s.entity_id.startsWith('sensor.')
    )
    return NextResponse.json({ connected: true, entities: relevant })
  } catch {
    return NextResponse.json({ connected: false, error: 'Connection failed' })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()

  // Save configuration
  if (body.action === 'configure') {
    const { url, token } = body as { url: string; token: string }
    if (!url || !token) return NextResponse.json({ error: 'URL and token required' }, { status: 400 })

    // Test connection
    try {
      const test = await fetch(`${url}/api/`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      })
      if (!test.ok) return NextResponse.json({ error: 'Invalid HA credentials' }, { status: 400 })
    } catch {
      return NextResponse.json({ error: 'Could not connect to Home Assistant' }, { status: 400 })
    }

    await prisma.integration.upsert({
      where: { userId_provider: { userId: user.id, provider: 'homeassistant' } },
      update: { status: 'connected', metadata: JSON.stringify({ url: url.replace(/\/$/, ''), token }) },
      create: {
        userId: user.id, provider: 'homeassistant', status: 'connected',
        metadata: JSON.stringify({ url: url.replace(/\/$/, ''), token }),
      },
    })
    return NextResponse.json({ success: true })
  }

  // Call a HA service
  if (body.action === 'call') {
    const { domain, service, entityId, serviceData } = body
    const ha = await getHAConfig(user.id)
    if (!ha) return NextResponse.json({ error: 'Not configured' }, { status: 400 })

    const res = await fetch(`${ha.url}/api/services/${domain}/${service}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ha.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: entityId, ...serviceData }),
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return NextResponse.json({ error: 'Service call failed' }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
