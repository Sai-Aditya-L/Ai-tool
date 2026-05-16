import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { randomUUID } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExecutionMode = 'observation' | 'approval' | 'assisted' | 'autonomous' | 'sandbox'

interface PendingAction {
  action: string
  params: unknown
  userId: string
  createdAt: Date
  description: string
}

// ─── Pending Actions Store (module-level in-memory) ──────────────────────────

export const pendingActions = new Map<string, PendingAction>()

// Clean up actions older than 15 minutes
function cleanupPendingActions() {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000)
  Array.from(pendingActions.entries()).forEach(([id, action]) => {
    if (action.createdAt < cutoff) pendingActions.delete(id)
  })
}
setInterval(cleanupPendingActions, 60 * 1000)

// ─── Actions Requiring Approval ───────────────────────────────────────────────

const APPROVAL_REQUIRED_ACTIONS = new Set(['form_fill', 'run_script', 'delete_file', 'write_file'])

// ─── URL Validation ───────────────────────────────────────────────────────────

function validateUrl(url: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(url)

    // Block javascript: protocol
    if (parsed.protocol === 'javascript:') {
      return { valid: false, reason: 'javascript: protocol is not allowed' }
    }

    // Block file: protocol
    if (parsed.protocol === 'file:') {
      return { valid: false, reason: 'file: protocol is not allowed' }
    }

    // Block data: protocol
    if (parsed.protocol === 'data:') {
      return { valid: false, reason: 'data: protocol is not allowed' }
    }

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: `Protocol ${parsed.protocol} is not allowed` }
    }

    const hostname = parsed.hostname.toLowerCase()

    // Block IPv6 link-local and loopback
    if (hostname.includes('::') && (hostname === '[::1]' || hostname === '[::]' || hostname.startsWith('[fe80'))) {
      return { valid: false, reason: 'IPv6 loopback/link-local addresses are not allowed' }
    }

    // Block ALL localhost/loopback addresses (any port)
    const localhostPatterns = [
      /^localhost$/i,
      /^127\.\d+\.\d+\.\d+$/,
      /^\[?::1\]?$/,
      /^\[?0+\]?:.*:0*1$/,  // IPv6 loopback variants
      /^0\.0\.0\.0$/,
    ]
    if (localhostPatterns.some(p => p.test(hostname))) {
      return { valid: false, reason: 'Localhost/loopback addresses are not allowed' }
    }

    // Block private IP ranges
    const ipv4Patterns = [
      /^10\.\d+\.\d+\.\d+$/,
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
      /^192\.168\.\d+\.\d+$/,
    ]
    if (ipv4Patterns.some(p => p.test(hostname))) {
      return { valid: false, reason: 'Private IP addresses are not allowed' }
    }

    return { valid: true }
  } catch {
    return { valid: false, reason: 'Invalid URL format' }
  }
}

// ─── Strip HTML Helper ────────────────────────────────────────────────────────

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

// ─── Extract Page Title ───────────────────────────────────────────────────────

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? stripHtml(match[1]) : 'Untitled'
}

// ─── Extract Links ────────────────────────────────────────────────────────────

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = []
  const regex = /href=["']([^"']+)["']/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl).toString()
      if (resolved.startsWith('http')) {
        links.push(resolved)
      }
    } catch {
      // skip invalid URLs
    }
  }
  return Array.from(new Set(links)).slice(0, 20)
}

// ─── Extract Metadata ────────────────────────────────────────────────────────

function extractMetadata(html: string): Record<string, string> {
  const meta: Record<string, string> = {}
  const regex = /<meta[^>]+>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    const tag = match[0]
    const nameMatch = tag.match(/(?:name|property)=["']([^"']+)["']/i)
    const contentMatch = tag.match(/content=["']([^"']+)["']/i)
    if (nameMatch && contentMatch) {
      meta[nameMatch[1]] = contentMatch[1]
    }
  }
  return meta
}

// ─── Action Executors ─────────────────────────────────────────────────────────

async function executeOpenUrl(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = String(params.url || '')
  const validation = validateUrl(url)
  if (!validation.valid) {
    return { error: `URL blocked: ${validation.reason}` }
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NEXUS-OS/1.0 (AI Assistant)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      return { error: `HTTP ${res.status}: ${res.statusText}`, url }
    }
    const html = await res.text()
    const title = extractTitle(html)
    const text = stripHtml(html).slice(0, 5000)
    return { title, text, url, status: res.status }
  } catch (err: unknown) {
    return { error: `Fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}`, url }
  }
}

async function executeExtractPage(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = String(params.url || '')
  const validation = validateUrl(url)
  if (!validation.valid) {
    return { error: `URL blocked: ${validation.reason}` }
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NEXUS-OS/1.0 (AI Assistant)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      return { error: `HTTP ${res.status}: ${res.statusText}`, url }
    }
    const html = await res.text()
    const title = extractTitle(html)
    const text = stripHtml(html).slice(0, 8000)
    const links = extractLinks(html, url)
    const metadata = extractMetadata(html)
    return { title, text, links, metadata, url, status: res.status }
  } catch (err: unknown) {
    return { error: `Fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}`, url }
  }
}

async function executeSearchWeb(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const query = String(params.query || '')
  if (!query) return { error: 'Query is required' }

  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
    const res = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'NEXUS-OS/1.0 (AI Assistant)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      return { error: `Search API error: HTTP ${res.status}`, query }
    }
    const data = await res.json()
    return {
      query,
      abstract: data.Abstract || null,
      abstractSource: data.AbstractSource || null,
      abstractUrl: data.AbstractURL || null,
      answer: data.Answer || null,
      answerType: data.AnswerType || null,
      definition: data.Definition || null,
      definitionSource: data.DefinitionSource || null,
      relatedTopics: (data.RelatedTopics || []).slice(0, 5).map((t: Record<string, unknown>) => ({
        text: t.Text || '',
        url: t.FirstURL || '',
      })),
      results: (data.Results || []).slice(0, 5).map((r: Record<string, unknown>) => ({
        title: r.Text || '',
        url: r.FirstURL || '',
      })),
    }
  } catch (err: unknown) {
    return { error: `Search failed: ${err instanceof Error ? err.message : 'Unknown error'}`, query }
  }
}

async function executeAnalyzeText(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const text = String(params.text || '')
  const instruction = String(params.instruction || 'Analyze this text and provide key insights.')
  if (!text) return { error: 'Text is required' }

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${instruction}\n\nText to analyze:\n${text.slice(0, 10000)}`,
        },
      ],
    })
    const content = msg.content[0]
    return {
      analysis: content.type === 'text' ? content.text : '',
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
    }
  } catch (err: unknown) {
    return { error: `Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}` }
  }
}

async function executeSummarizeUrl(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = String(params.url || '')
  const validation = validateUrl(url)
  if (!validation.valid) {
    return { error: `URL blocked: ${validation.reason}` }
  }

  // Fetch page
  const pageResult = await executeOpenUrl(params)
  if ('error' in pageResult) return pageResult

  // Summarize with Claude
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Summarize the following web page content in 3-5 concise bullet points:\n\nTitle: ${pageResult.title}\nURL: ${url}\n\nContent:\n${String(pageResult.text).slice(0, 8000)}`,
        },
      ],
    })
    const content = msg.content[0]
    return {
      url,
      title: pageResult.title,
      summary: content.type === 'text' ? content.text : '',
    }
  } catch (err: unknown) {
    return { error: `Summarization failed: ${err instanceof Error ? err.message : 'Unknown error'}`, url }
  }
}

// ─── Action Router ────────────────────────────────────────────────────────────

async function executeAction(
  action: string,
  params: Record<string, unknown>
): Promise<{ result: Record<string, unknown>; description: string }> {
  switch (action) {
    case 'open_url':
      return {
        result: await executeOpenUrl(params),
        description: `Fetch URL content from ${params.url}`,
      }
    case 'extract_page':
      return {
        result: await executeExtractPage(params),
        description: `Extract structured data from page ${params.url}`,
      }
    case 'search_web':
      return {
        result: await executeSearchWeb(params),
        description: `Web search for: ${params.query}`,
      }
    case 'analyze_text':
      return {
        result: await executeAnalyzeText(params),
        description: `Analyze text using Claude Haiku`,
      }
    case 'summarize_url':
      return {
        result: await executeSummarizeUrl(params),
        description: `Fetch and summarize URL: ${params.url}`,
      }
    case 'clipboard_read':
      return {
        result: {
          error: 'Clipboard not accessible server-side',
          explanation:
            'Browser clipboard access requires user gesture and is not available in server-side API context. Use a client-side clipboard API in the browser instead.',
        },
        description: 'Read clipboard contents',
      }
    case 'take_screenshot':
      return {
        result: {
          error: 'Screenshot not available in web mode',
          explanation:
            'Screenshot capture requires desktop application access. NEXUS operates as a web application and cannot capture your screen. Use your OS screenshot tools instead.',
        },
        description: 'Take a screenshot',
      }
    // Sensitive actions — mock responses only
    case 'form_fill':
      return {
        result: {
          mock: true,
          message: 'SAFETY: Form fill actions are not executed automatically. Please use your browser to fill forms manually.',
        },
        description: `Fill form with provided data`,
      }
    case 'run_script':
      return {
        result: {
          mock: true,
          message: 'SAFETY: Script execution is not supported for security reasons. NEXUS never runs arbitrary scripts.',
        },
        description: `Run script`,
      }
    case 'delete_file':
      return {
        result: {
          mock: true,
          message: 'SAFETY: File deletion is not supported. NEXUS never deletes files on your system.',
        },
        description: `Delete file`,
      }
    case 'write_file':
      return {
        result: {
          mock: true,
          message: 'SAFETY: File writing is not supported via the API. NEXUS cannot write to your local filesystem.',
        },
        description: `Write to file`,
      }
    default:
      return {
        result: { error: `Unknown action: ${action}` },
        description: `Unknown action: ${action}`,
      }
  }
}

// ─── Observation Mode ─────────────────────────────────────────────────────────

function observeAction(action: string, params: Record<string, unknown>): string {
  const actionDescriptions: Record<string, string> = {
    open_url: `Would fetch the URL "${params.url}" using HTTP GET, extract page title and text content (stripping HTML tags), and return up to 5000 characters of text.`,
    extract_page: `Would fetch "${params.url}" and return structured data including: page title, text content, all hyperlinks found on the page (up to 20), and HTML meta tags.`,
    search_web: `Would query DuckDuckGo Instant Answer API with search term "${params.query}" and return abstract, answer, definition, related topics, and direct results.`,
    analyze_text: `Would send the provided text to Claude claude-haiku-4-5-20251001 model with instruction "${params.instruction || 'Analyze this text'}" and return AI-generated analysis.`,
    summarize_url: `Would fetch "${params.url}", extract text content, then send to Claude claude-haiku-4-5-20251001 to generate a 3-5 bullet point summary.`,
    clipboard_read: `Would attempt to read clipboard contents — but this is not available server-side. Would return an explanation of the limitation.`,
    take_screenshot: `Would attempt to capture a screenshot — but this requires desktop application access which NEXUS does not have in web mode.`,
    form_fill: `Would fill a web form with the provided data. This action requires explicit approval and is never executed automatically.`,
    run_script: `Would attempt to execute a script. This action is blocked for security reasons.`,
    delete_file: `Would attempt to delete a file. This action is blocked for security reasons.`,
    write_file: `Would attempt to write data to a file. This action is blocked for security reasons.`,
  }
  return actionDescriptions[action] || `Would execute action "${action}" with params: ${JSON.stringify(params)}`
}

// ─── GET — List pending actions ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const userPending: Array<{ actionId: string; action: string; description: string; createdAt: Date }> = []
  for (const [actionId, pending] of Array.from(pendingActions.entries())) {
    if (pending.userId === user.id) {
      userPending.push({
        actionId,
        action: pending.action,
        description: pending.description,
        createdAt: pending.createdAt,
      })
    }
  }

  return NextResponse.json({ pending: userPending })
}

// ─── POST — Execute an action ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  let body: { action: string; params?: Record<string, unknown>; mode?: ExecutionMode }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, params = {}, mode = 'observation' } = body

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }

  const isSensitive = APPROVAL_REQUIRED_ACTIONS.has(action)

  // ── Observation mode: describe only ───────────────────────────────────────
  if (mode === 'observation') {
    const description = observeAction(action, params)
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'COMPUTER_CONTROL',
        entityType: 'observation',
        details: JSON.stringify({ action, mode, description }),
      },
    })
    return NextResponse.json({ result: description, approved: false, mode })
  }

  // ── Approval mode: queue pending ──────────────────────────────────────────
  if (mode === 'approval') {
    const { description } = await (async () => {
      return { description: observeAction(action, params) }
    })()
    // Enforce per-user limit of 10 pending actions
    const userPendingCount = Array.from(pendingActions.values()).filter(a => a.userId === user.id).length
    if (userPendingCount >= 10) {
      return NextResponse.json({ error: 'Too many pending actions. Approve or reject existing ones first.' }, { status: 429 })
    }
    const actionId = randomUUID()
    pendingActions.set(actionId, {
      action,
      params,
      userId: user.id,
      createdAt: new Date(),
      description,
    })
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'COMPUTER_CONTROL',
        entityType: 'pending',
        details: JSON.stringify({ action, mode, actionId, description }),
      },
    })
    return NextResponse.json({ pending: true, actionId, description, approved: false, mode })
  }

  // ── Assisted mode: execute safe actions, queue sensitive ──────────────────
  if (mode === 'assisted') {
    if (isSensitive) {
      const description = observeAction(action, params)
      // Enforce per-user limit of 10 pending actions
      const userPendingCount = Array.from(pendingActions.values()).filter(a => a.userId === user.id).length
      if (userPendingCount >= 10) {
        return NextResponse.json({ error: 'Too many pending actions. Approve or reject existing ones first.' }, { status: 429 })
      }
      const actionId = randomUUID()
      pendingActions.set(actionId, {
        action,
        params,
        userId: user.id,
        createdAt: new Date(),
        description,
      })
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'COMPUTER_CONTROL',
          entityType: 'pending',
          details: JSON.stringify({ action, mode, actionId, description }),
        },
      })
      return NextResponse.json({
        pending: true,
        actionId,
        description,
        approved: false,
        mode,
        reason: 'This action requires approval in assisted mode',
      })
    }
    // Safe action — execute
    const { result, description } = await executeAction(action, params)
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'COMPUTER_CONTROL',
        entityType: 'executed',
        details: JSON.stringify({ action, mode, description, result }),
      },
    })
    return NextResponse.json({ result: JSON.stringify(result), approved: true, mode, description })
  }

  // ── Autonomous mode: execute within safety boundaries ────────────────────
  if (mode === 'autonomous') {
    // Never allow file deletion or external service calls in autonomous
    if (action === 'delete_file' || action === 'run_script') {
      const description = observeAction(action, params)
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'COMPUTER_CONTROL',
          entityType: 'blocked',
          details: JSON.stringify({ action, mode, reason: 'Blocked by autonomous mode safety boundary' }),
        },
      })
      return NextResponse.json({
        result: `Action "${action}" blocked in autonomous mode: safety boundary prevents file deletion and script execution without explicit confirmation.`,
        approved: false,
        mode,
        blocked: true,
      })
    }
    const { result, description } = await executeAction(action, params)
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'COMPUTER_CONTROL',
        entityType: 'executed',
        details: JSON.stringify({ action, mode, description, result }),
      },
    })
    return NextResponse.json({ result: JSON.stringify(result), approved: true, mode, description })
  }

  // ── Sandbox mode: execute but log without affecting real data ────────────
  if (mode === 'sandbox') {
    const { result, description } = await executeAction(action, params)
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'COMPUTER_CONTROL',
        entityType: 'sandbox',
        details: JSON.stringify({ action, mode, description, result, sandboxed: true }),
      },
    })
    return NextResponse.json({
      result: JSON.stringify(result),
      approved: true,
      mode,
      description,
      sandboxed: true,
      note: 'This action was executed in sandbox mode — results are logged but do not affect real data.',
    })
  }

  return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 })
}
