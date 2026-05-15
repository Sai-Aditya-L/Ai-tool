import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGitHubClient, listRepos, isGitHubConnected } from '@/lib/github'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connected = await isGitHubConnected(user.id)
  if (!connected) {
    return NextResponse.json({ connected: false, repos: [] })
  }

  try {
    const token = await getGitHubClient(user.id)
    if (!token) return NextResponse.json({ connected: false, repos: [] })
    const repos = await listRepos(token)
    return NextResponse.json({ connected: true, repos })
  } catch (err) {
    console.error('GitHub repos error:', err)
    return NextResponse.json({ connected: true, repos: [], error: 'Failed to fetch repos' })
  }
}
