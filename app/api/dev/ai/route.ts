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
