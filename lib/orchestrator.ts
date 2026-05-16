import { prisma } from './prisma'
import { anthropic } from './anthropic'

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
  'Creative Agent':      `You are Nova, a specialized creative content agent. You brainstorm ideas, write stories, scripts, poems, and marketing copy. You bring a fresh, imaginative perspective to any creative challenge. Complete the assigned task efficiently and report your findings.`,
  'Health Agent':        `You are Pulse, a specialized health and wellness agent. You help users track fitness goals, build healthy routines, monitor sleep quality, and establish sustainable habits. You provide science-backed wellness guidance. Complete the assigned task efficiently and report your findings.`,
  'Crypto Agent':        `You are Cipher, a specialized cryptography and security protocols agent. You analyze encryption schemes, review cryptographic implementations, explain security protocols, and assess the strength of cryptographic systems. Complete the assigned task efficiently and report your findings.`,
  'Writing Agent':       `You are Scribe, a specialized writing and editorial agent. You draft polished documents, refine prose, improve clarity and style, and distill long-form content into concise summaries. You adapt tone and voice to suit any audience. Complete the assigned task efficiently and report your findings.`,
  'Learning Agent':      `You are Maven, a specialized learning and education agent. You design personalized study plans, break down complex concepts into clear explanations, generate quizzes, create flashcards, and adapt teaching methods to the learner's level. Complete the assigned task efficiently and report your findings.`,
  'Mapping Agent':       `You are Cartographer, a specialized location and geography agent. You analyze geographical data, plan optimal routes, research points of interest, evaluate neighborhoods, and provide detailed insights about places around the world. Complete the assigned task efficiently and report your findings.`,
  'Notification Agent':  `You are Beacon, a specialized notifications and alerts agent. You manage notification streams, prioritize alerts by urgency and relevance, suppress noise, and compile smart digests that surface only what truly matters to the user. Complete the assigned task efficiently and report your findings.`,
  'Environment Agent':   `You are Nimbus, a specialized environmental monitoring agent. You track weather conditions, air quality indices, climate trends, and environmental data for any location. You provide actionable insights on environmental conditions and their impact. Complete the assigned task efficiently and report your findings.`,
}

const NAME_TO_ROLE: Record<string, string> = {
  'Atlas':         'Travel Agent',
  'Chronos':       'Calendar Agent',
  'Hermes':        'Communication Agent',
  'Forge':         'Coding Agent',
  'Sentinel':      'Security Agent',
  'Ledger':        'Finance Agent',
  'Oracle':        'Research Agent',
  'Echo':          'Memory Agent',
  'Titan':         'Automation Agent',
  'Nova':          'Creative Agent',
  'Pulse':         'Health Agent',
  'Cipher':        'Crypto Agent',
  'Scribe':        'Writing Agent',
  'Maven':         'Learning Agent',
  'Cartographer':  'Mapping Agent',
  'Beacon':        'Notification Agent',
  'Nimbus':        'Environment Agent',
}

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

export async function analyzeQuery(query: string): Promise<OrchestratorDecision> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are the NEXUS Master Orchestrator. Analyze the user's query and determine which specialized agents should handle it.
Respond with JSON only: { "needsOrchestration": boolean, "agents": [{ "name": string, "role": string, "task": string }], "reason": string }
Available agents: Atlas (Travel Agent), Chronos (Calendar Agent), Hermes (Communication Agent), Forge (Coding Agent), Sentinel (Security Agent), Ledger (Finance Agent), Oracle (Research Agent), Echo (Memory Agent), Titan (Automation Agent), Nova (Creative Agent), Pulse (Health Agent), Cipher (Crypto Agent), Scribe (Writing Agent), Maven (Learning Agent), Cartographer (Mapping Agent), Beacon (Notification Agent), Nimbus (Environment Agent)
Only orchestrate if the query genuinely needs multiple specialized agents. Simple questions should return needsOrchestration: false.`,
    messages: [{ role: 'user', content: query }],
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
  try {
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match?.[0] ?? text) as OrchestratorDecision
    return parsed
  } catch {
    return { needsOrchestration: false, agents: [], reason: 'Failed to parse orchestrator response' }
  }
}

async function runAgent(
  agentSpec: { name: string; role: string; task: string },
  userId: string
): Promise<AgentResult> {
  let agentRecord = await prisma.agent.findFirst({
    where: { userId, role: agentSpec.role },
  })

  if (!agentRecord) {
    agentRecord = await prisma.agent.findFirst({
      where: { userId, name: { contains: agentSpec.name } },
    })
  }

  const agentId = agentRecord?.id

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
        data: { status: 'completed', output: result, completedAt: new Date() },
      })
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    result = `Error: ${errorMsg}`
    if (runRecord) {
      await prisma.agentRun.update({
        where: { id: runRecord.id },
        data: { status: 'failed', error: errorMsg, completedAt: new Date() },
      })
    }
  }

  return { agentName: agentSpec.name, result, runId: runRecord?.id ?? '' }
}

export async function orchestrate(query: string, userId: string): Promise<OrchestrationOutput> {
  const decision = await analyzeQuery(query)

  if (!decision.needsOrchestration || decision.agents.length === 0) {
    return { orchestrated: false, agents: [], results: [], merged: '' }
  }

  const validAgents = decision.agents
    .filter(a => !!(a.role || NAME_TO_ROLE[a.name]))
    .map(a => ({ ...a, role: a.role || NAME_TO_ROLE[a.name] || a.role }))

  if (validAgents.length === 0) {
    return { orchestrated: false, agents: [], results: [], merged: '' }
  }

  const results = await Promise.all(validAgents.map(spec => runAgent(spec, userId)))

  const agentSummaries = results.map(r => `## ${r.agentName}\n${r.result}`).join('\n\n')

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
