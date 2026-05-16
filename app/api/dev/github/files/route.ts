import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getGitHubClient,
  isGitHubConnected,
  getRepoContents,
  getFileContent,
  searchRepoCode,
  getRepoDetails,
} from '@/lib/github'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connected = await isGitHubConnected(user.id)
  if (!connected) {
    return NextResponse.json({ error: 'GitHub not connected' }, { status: 403 })
  }

  const token = await getGitHubClient(user.id)
  if (!token) {
    return NextResponse.json({ error: 'GitHub token not found' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const repoParam = searchParams.get('repo') ?? ''
  const pathParam = searchParams.get('path') ?? ''
  const fileParam = searchParams.get('file')
  const searchParam = searchParams.get('search')
  const detailsParam = searchParams.get('details')

  if (!repoParam || !repoParam.includes('/')) {
    return NextResponse.json({ error: 'Invalid repo parameter. Use owner/repo format.' }, { status: 400 })
  }

  const [owner, repo] = repoParam.split('/')

  try {
    // ?repo=owner/repo&details=1 → repo details
    if (detailsParam) {
      const details = await getRepoDetails(token, owner, repo)
      return NextResponse.json({ details })
    }

    // ?repo=owner/repo&search=query → code search
    if (searchParam) {
      const results = await searchRepoCode(token, owner, repo, searchParam)
      return NextResponse.json({ results })
    }

    // ?repo=owner/repo&file=src/foo.ts → file content
    if (fileParam !== null) {
      const file = await getFileContent(token, owner, repo, fileParam)
      return NextResponse.json({ file })
    }

    // ?repo=owner/repo&path= → directory listing (default)
    const contents = await getRepoContents(token, owner, repo, pathParam)
    return NextResponse.json({ contents })
  } catch (err: any) {
    console.error('[github/files] error:', err)
    return NextResponse.json({ error: err?.message || 'Request failed' }, { status: 500 })
  }
}
