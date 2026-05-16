export interface SearchResult {
  title: string
  url: string
  snippet: string
  publishedDate?: string
}

async function searchViaTavily(query: string, maxResults: number): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY!
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: maxResults,
    }),
  })
  if (!res.ok) throw new Error(`Tavily error: ${res.status}`)
  const data = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results || []).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || r.snippet || '',
    publishedDate: r.published_date || undefined,
  }))
}

async function searchViaDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NEXUS/1.0)',
      'Accept': 'text/html',
    },
  })
  if (!res.ok) throw new Error(`DuckDuckGo error: ${res.status}`)
  const html = await res.text()

  const results: SearchResult[] = []

  // Extract result links — pattern: <a class="result-link" href="...">title</a>
  const linkRegex = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  // Extract snippets — pattern: <td class="result-snippet">...</td>
  const snippetRegex = /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi

  const links: Array<{ url: string; title: string }> = []
  let match: RegExpExecArray | null
  while ((match = linkRegex.exec(html)) !== null) {
    const rawUrl = match[1].trim()
    const rawTitle = match[2].replace(/<[^>]+>/g, '').trim()
    if (rawUrl && rawTitle && !rawUrl.startsWith('//duckduckgo')) {
      links.push({ url: rawUrl, title: rawTitle })
    }
  }

  const snippets: string[] = []
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, '').trim())
  }

  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
    })
  }

  return results
}

export async function searchWeb(query: string, maxResults = 5): Promise<SearchResult[]> {
  try {
    if (process.env.TAVILY_API_KEY) {
      return await searchViaTavily(query, maxResults)
    }
    return await searchViaDuckDuckGo(query, maxResults)
  } catch (err) {
    console.error('[web-search] Error:', err)
    return []
  }
}
