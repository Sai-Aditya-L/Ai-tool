import { anthropic } from '@/lib/anthropic'

// ─── URL Validation ───────────────────────────────────────────────────────────

function validateUrl(url: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'javascript:') return { valid: false, reason: 'javascript: protocol is not allowed' }
    if (parsed.protocol === 'file:') return { valid: false, reason: 'file: protocol is not allowed' }
    if (parsed.protocol === 'data:') return { valid: false, reason: 'data: protocol is not allowed' }
    if (!['http:', 'https:'].includes(parsed.protocol)) return { valid: false, reason: `Protocol ${parsed.protocol} is not allowed` }
    const hostname = parsed.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      const port = parseInt(parsed.port || (parsed.protocol === 'https:' ? '443' : '80'))
      const blockedPorts = [3000, 3001, 5000, 5432, 6379, 8080, 8443, 9000, 22, 21, 25, 587]
      if (blockedPorts.includes(port)) return { valid: false, reason: `Localhost port ${port} is blocked` }
    }
    const ipv4Patterns = [/^10\.\d+\.\d+\.\d+$/, /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, /^192\.168\.\d+\.\d+$/]
    if (ipv4Patterns.some(p => p.test(hostname))) return { valid: false, reason: 'Private IP addresses are not allowed' }
    return { valid: true }
  } catch {
    return { valid: false, reason: 'Invalid URL format' }
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? stripHtml(match[1]) : 'Untitled'
}

// ─── Execute Approved Action ──────────────────────────────────────────────────

export async function executeApprovedAction(
  action: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (action) {
    case 'open_url': {
      const url = String(params.url || '')
      const v = validateUrl(url)
      if (!v.valid) return { error: `URL blocked: ${v.reason}` }
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'NEXUS-OS/1.0 (AI Assistant)' },
          signal: AbortSignal.timeout(10000),
        })
        const html = await res.text()
        return { title: extractTitle(html), text: stripHtml(html).slice(0, 5000), url, status: res.status }
      } catch (err: unknown) {
        return { error: `Fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}` }
      }
    }

    case 'extract_page': {
      const url = String(params.url || '')
      const v = validateUrl(url)
      if (!v.valid) return { error: `URL blocked: ${v.reason}` }
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'NEXUS-OS/1.0 (AI Assistant)' },
          signal: AbortSignal.timeout(10000),
        })
        const html = await res.text()
        const links: string[] = []
        const regex = /href=["']([^"']+)["']/gi
        let match
        while ((match = regex.exec(html)) !== null) {
          try { links.push(new URL(match[1], url).toString()) } catch {}
        }
        return {
          title: extractTitle(html),
          text: stripHtml(html).slice(0, 8000),
          links: [...new Set(links)].filter(l => l.startsWith('http')).slice(0, 20),
          url,
          status: res.status,
        }
      } catch (err: unknown) {
        return { error: `Fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}` }
      }
    }

    case 'search_web': {
      const query = String(params.query || '')
      try {
        const res = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
          { headers: { 'User-Agent': 'NEXUS-OS/1.0' }, signal: AbortSignal.timeout(10000) }
        )
        const data = await res.json()
        return {
          query,
          abstract: data.Abstract || null,
          answer: data.Answer || null,
          relatedTopics: (data.RelatedTopics || []).slice(0, 5).map((t: Record<string, unknown>) => ({ text: t.Text, url: t.FirstURL })),
        }
      } catch (err: unknown) {
        return { error: `Search failed: ${err instanceof Error ? err.message : 'Unknown error'}` }
      }
    }

    case 'analyze_text': {
      const text = String(params.text || '')
      const instruction = String(params.instruction || 'Analyze this text and provide key insights.')
      try {
        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: `${instruction}\n\nText:\n${text.slice(0, 10000)}` }],
        })
        const c = msg.content[0]
        return { analysis: c.type === 'text' ? c.text : '' }
      } catch (err: unknown) {
        return { error: `Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}` }
      }
    }

    case 'summarize_url': {
      const url = String(params.url || '')
      const v = validateUrl(url)
      if (!v.valid) return { error: `URL blocked: ${v.reason}` }
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'NEXUS-OS/1.0' }, signal: AbortSignal.timeout(10000) })
        const html = await res.text()
        const text = stripHtml(html).slice(0, 8000)
        const title = extractTitle(html)
        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: `Summarize in 3-5 bullet points:\nTitle: ${title}\nURL: ${url}\n\n${text}` }],
        })
        const c = msg.content[0]
        return { url, title, summary: c.type === 'text' ? c.text : '' }
      } catch (err: unknown) {
        return { error: `Summarization failed: ${err instanceof Error ? err.message : 'Unknown error'}` }
      }
    }

    case 'form_fill':
      return { mock: true, message: 'SAFETY: Form fill actions require explicit UI interaction.' }
    case 'run_script':
      return { mock: true, message: 'SAFETY: Script execution is not supported for security reasons.' }
    case 'delete_file':
      return { mock: true, message: 'SAFETY: File deletion is not supported. NEXUS never deletes files.' }
    case 'write_file':
      return { mock: true, message: 'SAFETY: File writing via API is not supported.' }
    case 'clipboard_read':
      return { error: 'Clipboard not accessible server-side' }
    case 'take_screenshot':
      return { error: 'Screenshot not available in web mode' }
    default:
      return { error: `Unknown action: ${action}` }
  }
}
