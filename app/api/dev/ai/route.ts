import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createMessage, AIProvider } from '@/lib/ai-provider'

const SYSTEM_PROMPTS: Record<string, string> = {
  code_review:
    'You are Forge, an expert code reviewer. Analyze the provided code for security vulnerabilities, performance issues, style problems, logic errors, and documentation gaps. Structure your response with clear sections: ## Security, ## Performance, ## Style, ## Logic, ## Documentation. Be specific, actionable, and concise.',
  pr_summary:
    'You are Forge, an expert at writing clear, informative PR descriptions. Generate a PR summary with: ## Overview (2-3 sentences), ## Key Changes (bullet points), ## Testing Checklist (checkboxes), ## Notes for Reviewers.',
  commit_message:
    'You are Forge, a Git expert. Generate a conventional commit message. Format: <type>(<scope>): <description>\n\n<body>\n\n<footer>. Be specific about what changed and why.',
  doc_generator:
    'You are Forge, a technical writing expert. Generate comprehensive documentation for the provided code. Include: purpose, parameters/props, return values, examples, and edge cases.',
  architecture_advisor:
    'You are Forge, a senior software architect. Provide structured architectural recommendations including: approach overview, pros and cons, implementation steps, and potential pitfalls. Use ASCII diagrams where helpful.',
  summarize_repo:
    'You are Forge, an expert at understanding codebases. Summarize this repository with clear sections: ## Purpose, ## Tech Stack, ## Key Features, ## Architecture Notes, ## Getting Started. Be concise and developer-friendly.',
  security_review:
    'You are Sentinel, a security-focused code reviewer. Analyze the provided code for: SQL injection, XSS, authentication flaws, insecure dependencies, secrets in code, input validation issues, and cryptography weaknesses. Structure your response with: ## Critical Issues, ## High Severity, ## Medium Severity, ## Recommendations. Be specific and actionable.',
  test_generator:
    'You are Forge, a testing expert. Generate comprehensive tests for the provided code. Include: unit tests, edge cases, and error cases. Use the specified testing framework if provided. Return only well-formatted, runnable test code with clear comments.',
  explain_stack_trace:
    'You are Forge, a debugging expert. Explain this error or stack trace in detail. Structure your response with: ## What Went Wrong, ## Root Cause, ## How to Fix, ## Prevention. Be clear, actionable, and concise.',
  find_todos:
    'You are Forge, a code quality analyst. Summarize the TODO/FIXME items found in the provided search results. Group them by priority (Critical, High, Medium, Low). Suggest which items should be addressed first and why.',
}

function buildUserMessage(tool: string, input: Record<string, string>): string {
  switch (tool) {
    case 'code_review': {
      const lang = input.language && input.language !== 'auto' ? ` (${input.language})` : ''
      const focus = input.focus ? `\n\nFocus areas: ${input.focus}` : ''
      return `Review the following code${lang}:${focus}\n\n\`\`\`\n${input.code}\n\`\`\``
    }
    case 'pr_summary': {
      const title = input.prTitle ? `PR Title: ${input.prTitle}\n` : ''
      const base = input.baseBranch ? `Base Branch: ${input.baseBranch}\n` : ''
      return `${title}${base}\nChanges / Diff:\n${input.diff}`
    }
    case 'commit_message': {
      const type = input.commitType ? `Preferred commit type: ${input.commitType}\n\n` : ''
      return `${type}Staged diff:\n${input.diff}`
    }
    case 'doc_generator': {
      const style = input.docStyle ? `Documentation style: ${input.docStyle}\n\n` : ''
      return `${style}Code to document:\n\`\`\`\n${input.code}\n\`\`\``
    }
    case 'architecture_advisor': {
      const focus = input.focusArea ? `Focus area: ${input.focusArea}\n\n` : ''
      return `${focus}Requirements / Description:\n${input.description}`
    }
    case 'summarize_repo': {
      const topics = input.topics ? `\nTopics: ${input.topics}` : ''
      const langs = input.languages ? `\nLanguages: ${input.languages}` : ''
      const desc = input.description ? `\nDescription: ${input.description}` : ''
      const readme = input.readme ? `\n\nREADME:\n${input.readme}` : ''
      return `Repository: ${input.repoName}${desc}${langs}${topics}${readme}`
    }
    case 'security_review': {
      const lang = input.language && input.language !== 'auto' ? ` (${input.language})` : ''
      return `Review the following code for security issues${lang}:\n\n\`\`\`\n${input.code}\n\`\`\``
    }
    case 'test_generator': {
      const lang = input.language && input.language !== 'auto' ? ` (${input.language})` : ''
      const fw = input.framework ? `\nTesting framework: ${input.framework}` : ''
      return `Generate tests for the following code${lang}:${fw}\n\n\`\`\`\n${input.code}\n\`\`\``
    }
    case 'explain_stack_trace': {
      const ctx = input.context ? `\n\nContext: ${input.context}` : ''
      return `Stack trace / Error:\n\`\`\`\n${input.stackTrace}\n\`\`\`${ctx}`
    }
    case 'find_todos': {
      return `Search results containing TODO/FIXME items:\n\n${input.searchResults}`
    }
    default:
      return JSON.stringify(input)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let body: { tool: string; input: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tool, input } = body

  if (!tool || !SYSTEM_PROMPTS[tool]) {
    return NextResponse.json({ error: 'Unknown tool' }, { status: 400 })
  }

  if (!input || typeof input !== 'object') {
    return NextResponse.json({ error: 'Missing input' }, { status: 400 })
  }

  const systemPrompt = SYSTEM_PROMPTS[tool]
  const userMessage = buildUserMessage(tool, input)

  try {
    const prefs = await prisma.userPreferences.findUnique({ where: { userId: user.id } })
    const provider = (prefs?.aiProvider || 'anthropic') as AIProvider
    const model = provider === 'openai'
      ? (prefs?.openaiModel || 'gpt-4o')
      : (prefs?.aiModel || 'claude-sonnet-4-6')

    const response = await createMessage({
      provider,
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: [],
      maxTokens: 2048,
    })

    return NextResponse.json({ result: response.text ?? '' })
  } catch (err: any) {
    console.error('[dev/ai] AI error:', err)
    return NextResponse.json(
      { error: err?.message || 'AI request failed' },
      { status: 500 }
    )
  }
}
