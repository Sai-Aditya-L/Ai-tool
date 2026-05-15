import { prisma } from '@/lib/prisma'

export async function getGitHubClient(userId: string): Promise<string | null> {
  const integration = await prisma.integration.findFirst({
    where: { userId, provider: 'github', status: 'connected' },
  })
  if (!integration?.accessToken) return null
  return integration.accessToken
}

export async function listRepos(token: string, page = 1) {
  const res = await fetch(
    `https://api.github.com/user/repos?sort=updated&per_page=20&page=${page}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )
  return res.json()
}

export async function listPRs(token: string, owner: string, repo: string) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=20`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )
  return res.json()
}

export async function getPRDiff(token: string, owner: string, repo: string, prNumber: number) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3.diff',
      },
    }
  )
  return res.text()
}

export async function getRecentCommits(token: string, owner: string, repo: string) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )
  return res.json()
}

export async function isGitHubConnected(userId: string): Promise<boolean> {
  const integration = await prisma.integration.findFirst({
    where: { userId, provider: 'github', status: 'connected' },
  })
  return !!integration?.accessToken
}
