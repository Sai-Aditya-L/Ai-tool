import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGitHubClient, listPRs, getPRDiff, isGitHubConnected } from '@/lib/github'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const repo = searchParams.get('repo')
  if (!repo) return NextResponse.json({ error: 'repo param required' }, { status: 400 })

  const connected = await isGitHubConnected(user.id)
  if (!connected) return NextResponse.json({ error: 'GitHub not connected' }, { status: 403 })

  try {
    const token = await getGitHubClient(user.id)
    if (!token) return NextResponse.json({ prs: [] })
    const [owner, repoName] = repo.split('/')
    const prs = await listPRs(token, owner, repoName)
    return NextResponse.json({ prs })
  } catch (err) {
    console.error('GitHub PRs error:', err)
    return NextResponse.json({ prs: [], error: 'Failed to fetch PRs' })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connected = await isGitHubConnected(user.id)
  if (!connected) return NextResponse.json({ error: 'GitHub not connected' }, { status: 403 })

  const { repo, prNumber } = await request.json()
  if (!repo || !prNumber) return NextResponse.json({ error: 'repo and prNumber required' }, { status: 400 })

  try {
    const token = await getGitHubClient(user.id)
    if (!token) return NextResponse.json({ error: 'GitHub not connected' }, { status: 403 })
    const [owner, repoName] = repo.split('/')
    const diff = await getPRDiff(token, owner, repoName, Number(prNumber))
    return NextResponse.json({ diff })
  } catch (err) {
    console.error('GitHub PR diff error:', err)
    return NextResponse.json({ error: 'Failed to fetch PR diff' }, { status: 500 })
  }
}
