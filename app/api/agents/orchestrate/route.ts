import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

// ---------------------------------------------------------------------------
// Role-specific system prompts (mirrored from /api/agents/[id]/runs/route.ts)
// ---------------------------------------------------------------------------
const ROLE_PROMPTS: Record<string, string> = {
  'Travel Agent':        `You are Atlas, a specialized travel planning agent. You help users plan trips, find the best routes, accommodations, and activities. You have deep knowledge of travel logistics, visa requirements, and cultural nuances. Complete the assigned task efficiently and report your findings.`,
  'Coding Agent':        `You are Forge, a specialized software development agent. You write clean, efficient code, debug issues, review pull requests, and architect solutions. You are proficient in multiple programming languages and frameworks. Complete the assigned task efficiently and report your findings.`,
  'Calendar Agent':      `You are Chronos, a specialized scheduling agent. You manage calendars, schedule meetings, detect conflicts, and optimize the user's time. You are meticulous about time zones and availability. Complete the assigned task efficiently and report your findings.`,
  'Research Agent':      `You are Oracle, a specialized research and information agent. You gather, synthesize, and analyze information from multiple sources to deliver comprehensive, accurate insights. Complete the assigned task efficiently and report your findings.`,
  'Finance Agent':       `You are Ledger, a specialized financial tracking agent. You track expenses, analyze spending patterns, monitor budgets, and provide actionable financial insights. Complete the assigned task efficiently and report your findings.`,
  'Communication Agent': `You are Hermes, a specialized communication agent. You draft emails, compose messages, summarize correspondence, and help maintain clear and professional communication. Complete the assigned task efficiently and report your findings.`,
  'Security Agent':      `You are Sentinel, a specialized security monitoring agent. You identify risks, review permissions, flag suspicious activity, and recommend security best practices. Complete the assigned task efficiently and report your findings.`,
  'Memory Agent':        `You are Echo, a specialized memory and knowledge agent. You store, recall, and organize information about the user's preferences, goals, and context to provide personalized assistance. Complete the assigned task efficiently and report your findings.`,
  'Automation Agent':    `You are Titan, a specialized workflow automation agent. You design, execute, and optimize automated workflows to save the user time and reduce repetitive tasks. Complete the assigned task efficiently and report your findings.`,
}

// Map agent names to roles (for orchestrator → role lookup)
const NAME_TO_ROLE: Record<string, string> = {
  'Atlas':    'Travel Agent',
  'Chronos':  'Calendar Agent',
  'Hermes':   'Communication Agent',
  'Forge':    'Coding Agent',
  'Sentinel': 'Security Agent',
  'Ledger':   'Finance Agent',
  'Oracle':   'Research Agent',
  'Echo':     'Memory Agent',
  'Titan':    'Automation Agent',
}

// ---------------------------------------------------------------------------
// Core orchestration logic (exported so chat route can call it directly)
// ---------------------------------------------------------------------------

export interface OrchestratorDecision {
  needsOrchestration: boolean
  agents: Array<{ name: string; role: string; task: string }>
  reason: string
}

export interface AgentResult {
  agentName: string
  result: string
  runId: string
}

export interface OrchestrationOutput {
  orchestrated: boolean
  agents: string[]
  results: AgentResult[]
  merged: string
}

/**
 * Ask Claude whether this query needs multi-agent orchestration.
 */
export async function analyzeQuery(query: string): Promise<OrchestratorDecision> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are the NEXUS Master Orchestrator. Analyze the user's query and determine which specialized agents should handle it.
Respond with JSON only: { "needsOrchestration": boolean, "agents": [{ "name": string, "role": string, "task": string }], "reason": string }
Available agents: Atlas (Travel Agent), Chronos (Calendar Agent), Hermes (Communication Agent), Forge (Coding Agent), Sentinel (Security Agent), Ledger (Finance Agent), Oracle (Research Agent), Echo (Memory Agent), Titan (Automation Agent)
Only orchestrate if the query genuinely needs multiple specialized agents. Simple questions should return needsOrchestration: false.`,
    messages: [{ role: 'user', content: query }],
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
  try {
    // Extract JSON even if Claude wraps it in markdown code fences
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match?.[0] ?? text) as OrchestratorDecision
    return parsed
  } catch {
    return { needsOrchestration: false, agents: [], reason: 'Failed to parse orchestrator response' }
  }
}

/**
 * Run a single named agent for a specific sub-task and record in DB.
 */
async function runAgent(
  agentSpec: { name: string; role: string; task: string },
  userId: string
): Promise<AgentResult> {
  // Look up the agent in DB or fall back to a minimal default
  let agentRecord = await prisma.agent.findFirst({
    where: { userId, role: agentSpec.role },
  })

  // If not found in DB, find by name as fallback
  if (!agentRecord) {
    agentRecord = await prisma.agent.findFirst({
      where: { userId, name: { contains: agentSpec.name } },
    })
  }

  // Still nothing — use a placeholder agent id from any existing agent,
  // or create a temporary representation without persisting
  const agentId = agentRecord?.id

  // Create AgentRun — only if we have a valid agentId
  let runRecord: { id: string } | null = null
  if (agentId) {
    runRecord = await prisma.agentRun.create({
      data: {
        agentId,
        userId,
        task: agentSpec.task,
        status: 'running',
        startedAt: new Date(),
      },
    })
  }

  const systemPrompt =
    agentRecord?.systemPrompt ??
    ROLE_PROMPTS[agentSpec.role] ??
    `You are ${agentSpec.name}, a specialized AI agent with role: ${agentSpec.role}. Complete the assigned task efficiently and report your findings.`

  let result = ''
  try {
    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: agentSpec.task }],
    })
    result = aiResponse.content.find(b => b.type === 'text')?.text ?? 'Task completed.'

    if (runRecord) {
      await prisma.agentRun.update({
        where: { id: runRecord.id },
        data: {
          status: 'completed',
          output: result,
          completedAt: new Date(),
        },
      })
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    result = `Error: ${errorMsg}`
    if (runRecord) {
      await prisma.agentRun.update({
        where: { id: runRecord.id },
        data: {
          status: 'failed',
          error: errorMsg,
          completedAt: new Date(),
        },
      })
    }
  }

  return {
    agentName: agentSpec.name,
    result,
    runId: runRecord?.id ?? '',
  }
}

/**
 * Full orchestration flow: analyze → deploy → merge.
 * Called from POST handler and also from chat route.
 */
export async function orchestrate(query: string, userId: string): Promise<OrchestrationOutput> {
  const decision = await analyzeQuery(query)

  if (!decision.needsOrchestration || decision.agents.length === 0) {
    return {
      orchestrated: false,
      agents: [],
      results: [],
      merged: '',
    }
  }

  // Filter out Nimbus (not in DB by spec) and agents with no known role
  const validAgents = decision.agents.filter(a => {
    const role = a.role || NAME_TO_ROLE[a.name]
    return role && role !== 'Weather Agent' // Nimbus/Weather Agent excluded
  }).map(a => ({
    ...a,
    role: a.role || NAME_TO_ROLE[a.name] || a.role,
  }))

  if (validAgents.length === 0) {
    return { orchestrated: false, agents: [], results: [], merged: '' }
  }

  // Execute agents in parallel
  const results = await Promise.all(
    validAgents.map(agentSpec => runAgent(agentSpec, userId))
  )

  // Merge results into a unified response using Claude
  const agentSummaries = results
    .map(r => `## ${r.agentName}\n${r.result}`)
    .join('\n\n')

  const mergeResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are the NEXUS Master Orchestrator. Synthesize the outputs from multiple specialized agents into a single coherent, well-structured response for the user. Preserve key details from each agent's findings.`,
    messages: [
      {
        role: 'user',
        content: `Original query: ${query}\n\nAgent outputs:\n\n${agentSummaries}\n\nPlease provide a unified, comprehensive response.`,
      },
    ],
  })

  const merged = mergeResponse.content.find(b => b.type === 'text')?.text ?? agentSummaries

  return {
    orchestrated: true,
    agents: validAgents.map(a => a.name),
    results,
    merged,
  }
}

// ---------------------------------------------------------------------------
// POST /api/agents/orchestrate
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let body: { query?: string; userId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { query } = body
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  try {
    const output = await orchestrate(query.trim(), user.id)
    return NextResponse.json(output)
  } catch (error) {
    console.error('Orchestration error:', error)
    return NextResponse.json(
      { error: 'Orchestration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
