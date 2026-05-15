import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.SPOTIFY_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'SPOTIFY_CLIENT_ID not configured' }, { status: 503 })
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/spotify/callback`
  const scope = 'user-read-currently-playing user-read-playback-state user-modify-playback-state'
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
  })

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`)
}
