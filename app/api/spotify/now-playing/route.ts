import { NextResponse } from 'next/server'
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

    if (!data.access_token) {
      console.error('Spotify token refresh failed:', data)
      return null
    }

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
  } catch (err) {
    console.error('Error refreshing Spotify token:', err)
    return null
  }
}

async function getValidToken(integration: Integration): Promise<string | null> {
  // Check if token is expired (with 60s buffer)
  if (integration.expiresAt && new Date(integration.expiresAt).getTime() < Date.now() + 60_000) {
    return refreshSpotifyToken(integration)
  }
  return integration.accessToken
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId: user.id, provider: 'spotify' } },
  })

  if (!integration || integration.status !== 'connected') {
    return NextResponse.json({ connected: false })
  }

  const accessToken = await getValidToken(integration)
  if (!accessToken) {
    return NextResponse.json({ connected: false, error: 'Token refresh failed' })
  }

  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (res.status === 204 || res.status === 200 && res.headers.get('content-length') === '0') {
      return NextResponse.json({ connected: true, playing: false })
    }

    if (!res.ok) {
      return NextResponse.json({ connected: true, playing: false })
    }

    const data = await res.json()

    if (!data || !data.item) {
      return NextResponse.json({ connected: true, playing: false })
    }

    const track = data.item
    const artists = track.artists?.map((a: { name: string }) => a.name).join(', ') || ''
    const albumArt = track.album?.images?.[0]?.url || null

    return NextResponse.json({
      connected: true,
      playing: data.is_playing,
      track: {
        id: track.id,
        name: track.name,
        artists,
        album: track.album?.name || '',
        albumArt,
        duration: track.duration_ms,
        progress: data.progress_ms,
      },
    })
  } catch (err) {
    console.error('Spotify now-playing error:', err)
    return NextResponse.json({ connected: true, playing: false })
  }
}
