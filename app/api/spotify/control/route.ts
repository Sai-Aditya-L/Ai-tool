import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Integration } from '@prisma/client'

async function refreshSpotifyToken(integration: Integration): Promise<string | null> {
  try {
    const creds = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64')

    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=refresh_token&refresh_token=${integration.refreshToken}`,
    })

    const data = await resp.json()
    if (!data.access_token) return null

    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000)
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        accessToken: data.access_token,
        expiresAt,
        ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      },
    })

    return data.access_token
  } catch {
    return null
  }
}

async function getValidToken(integration: Integration): Promise<string | null> {
  if (integration.expiresAt && new Date(integration.expiresAt).getTime() < Date.now() + 60_000) {
    return refreshSpotifyToken(integration)
  }
  return integration.accessToken
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId: user.id, provider: 'spotify' } },
  })

  if (!integration || integration.status !== 'connected') {
    return NextResponse.json({ error: 'Spotify not connected' }, { status: 400 })
  }

  const accessToken = await getValidToken(integration)
  if (!accessToken) {
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
  }

  const body = await req.json()
  const { action, volume } = body as { action: string; volume?: number }

  const SPOTIFY_API = 'https://api.spotify.com/v1/me/player'

  let spotifyRes: Response

  switch (action) {
    case 'play':
      spotifyRes = await fetch(`${SPOTIFY_API}/play`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      break

    case 'pause':
      spotifyRes = await fetch(`${SPOTIFY_API}/pause`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      break

    case 'next':
      spotifyRes = await fetch(`${SPOTIFY_API}/next`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      break

    case 'prev':
      spotifyRes = await fetch(`${SPOTIFY_API}/previous`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      break

    case 'volume':
      if (volume === undefined || volume < 0 || volume > 100) {
        return NextResponse.json({ error: 'Invalid volume value (0-100)' }, { status: 400 })
      }
      spotifyRes = await fetch(`${SPOTIFY_API}/volume?volume_percent=${Math.round(volume)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      break

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Spotify returns 204 No Content on success for most control endpoints
  if (spotifyRes.status === 204 || spotifyRes.ok) {
    return NextResponse.json({ success: true, action })
  }

  let errBody: unknown
  try {
    errBody = await spotifyRes.json()
  } catch {
    errBody = { status: spotifyRes.status }
  }
  console.error('Spotify control error:', errBody)
  return NextResponse.json({ error: 'Spotify API error', details: errBody }, { status: spotifyRes.status })
}
