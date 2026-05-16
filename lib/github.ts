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

export async function getRepoDetails(token: string, owner: string, repo: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  }

  const [repoRes, readmeRes, languagesRes] = await Promise.allSettled([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers }),
  ])

  const repoData = repoRes.status === 'fulfilled' && repoRes.value.ok
    ? await repoRes.value.json()
    : {}

  let readme = ''
  if (readmeRes.status === 'fulfilled' && readmeRes.value.ok) {
    const readmeData = await readmeRes.value.json()
    if (readmeData.content) {
      try {
        readme = Buffer.from(readmeData.content, 'base64').toString('utf-8')
        // Truncate long READMEs
        if (readme.length > 4000) readme = readme.slice(0, 4000) + '\n...(truncated)'
      } catch {
        readme = ''
      }
    }
  }

  const languages = languagesRes.status === 'fulfilled' && languagesRes.value.ok
    ? await languagesRes.value.json()
    : {}

  return {
    name: repoData.name ?? repo,
    description: repoData.description ?? '',
    stars: repoData.stargazers_count ?? 0,
    forks: repoData.forks_count ?? 0,
    language: repoData.language ?? null,
    topics: repoData.topics ?? [],
    readme,
    languages,
  }
}

export async function getRepoContents(token: string, owner: string, repo: string, path = '') {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data.map((item: any) => ({
    name: item.name,
    path: item.path,
    type: item.type as 'file' | 'dir',
    size: item.size ?? 0,
    sha: item.sha,
  }))
}

export async function getFileContent(token: string, owner: string, repo: string, path: string) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`)
  const data = await res.json()
  if (data.size > 102400) throw new Error('File too large (>100KB)')
  const content = data.encoding === 'base64' && data.content
    ? Buffer.from(data.content, 'base64').toString('utf-8')
    : data.content ?? ''
  return { content, size: data.size ?? 0, encoding: data.encoding ?? 'utf-8' }
}

export async function searchRepoCode(token: string, owner: string, repo: string, query: string) {
  const q = encodeURIComponent(`${query} repo:${owner}/${repo}`)
  const res = await fetch(
    `https://api.github.com/search/code?q=${q}&per_page=10`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.items ?? []).map((item: any) => ({
    name: item.name,
    path: item.path,
    html_url: item.html_url,
    score: item.score,
  }))
}

export async function getRepoLanguages(token: string, owner: string, repo: string) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/languages`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )
  if (!res.ok) return {}
  return res.json()
}
