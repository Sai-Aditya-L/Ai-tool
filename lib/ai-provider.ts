import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { NEXUS_TOOLS } from './anthropic'

export type AIProvider = 'anthropic' | 'openai'

export interface UnifiedMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface UnifiedToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface UnifiedResponse {
  text: string | null
  toolCalls: UnifiedToolCall[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens'
  // raw continuation messages needed for next loop iteration
  assistantMessage: Anthropic.MessageParam | OpenAI.ChatCompletionMessageParam
}

// ---------------------------------------------------------------------------
// Helper: convert Anthropic tool format → OpenAI function format
// ---------------------------------------------------------------------------
function convertToolsToOpenAI(tools: Anthropic.Tool[]): OpenAI.ChatCompletionTool[] {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }))
}

// ---------------------------------------------------------------------------
// Core unified message creation function
// ---------------------------------------------------------------------------
export async function createMessage(options: {
  provider: AIProvider
  anthropicKey?: string
  openaiKey?: string
  model: string
  system: string
  messages: (Anthropic.MessageParam | OpenAI.ChatCompletionMessageParam)[]
  tools?: Anthropic.Tool[]
  maxTokens?: number
}): Promise<UnifiedResponse> {
  const { provider, model, system, messages, tools, maxTokens = 4096 } = options

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({
      apiKey: options.anthropicKey || process.env.ANTHROPIC_API_KEY,
    })

    const anthropicTools = tools !== undefined ? tools : NEXUS_TOOLS
    const createParams: Parameters<typeof anthropic.messages.create>[0] = {
      model,
      max_tokens: maxTokens,
      system,
      messages: messages as Anthropic.MessageParam[],
    }
    if (anthropicTools.length > 0) {
      createParams.tools = anthropicTools
    }

    const response = await anthropic.messages.create({ ...createParams, stream: false })

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

    const toolCalls: UnifiedToolCall[] = toolUseBlocks.map(b => ({
      id: b.id,
      name: b.name,
      input: b.input as Record<string, unknown>,
    }))

    let stopReason: UnifiedResponse['stopReason'] = 'end_turn'
    if (response.stop_reason === 'tool_use') stopReason = 'tool_use'
    else if (response.stop_reason === 'max_tokens') stopReason = 'max_tokens'

    const assistantMessage: Anthropic.MessageParam = {
      role: 'assistant',
      content: response.content,
    }

    return {
      text: textBlock?.text ?? null,
      toolCalls,
      stopReason,
      assistantMessage,
    }
  }

  // OpenAI path
  if (!options.openaiKey && !process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Add it in Settings → Assistant.')
  }

  const openai = new OpenAI({
    apiKey: options.openaiKey || process.env.OPENAI_API_KEY,
  })

  const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...(messages as OpenAI.ChatCompletionMessageParam[]),
  ]

  const openaiToolSource = tools !== undefined ? tools : NEXUS_TOOLS
  const openaiTools = convertToolsToOpenAI(openaiToolSource)

  const openaiParams: Parameters<typeof openai.chat.completions.create>[0] = {
    model,
    max_tokens: maxTokens,
    messages: openaiMessages,
  }
  if (openaiTools.length > 0) {
    openaiParams.tools = openaiTools
  }

  const response = await openai.chat.completions.create({ ...openaiParams, stream: false })

  const choice = response.choices[0]
  const text = choice.message.content ?? null

  type FnToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
  const toolCalls: UnifiedToolCall[] = ((choice.message.tool_calls ?? []) as FnToolCall[])
    .filter(tc => tc.type === 'function' && tc.function)
    .map(tc => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }))

  let stopReason: UnifiedResponse['stopReason'] = 'end_turn'
  if (choice.finish_reason === 'tool_calls') stopReason = 'tool_use'
  else if (choice.finish_reason === 'length') stopReason = 'max_tokens'

  const assistantMessage = choice.message as OpenAI.ChatCompletionMessageParam

  return {
    text,
    toolCalls,
    stopReason,
    assistantMessage,
  }
}

// ---------------------------------------------------------------------------
// Helper: build tool result messages for the next loop iteration
// ---------------------------------------------------------------------------
export function buildToolResultMessages(
  provider: AIProvider,
  toolCalls: UnifiedToolCall[],
  results: { id: string; content: string }[]
): (Anthropic.MessageParam | OpenAI.ChatCompletionMessageParam)[] {
  if (provider === 'anthropic') {
    const anthropicMessage: Anthropic.MessageParam = {
      role: 'user',
      content: results.map(r => ({
        type: 'tool_result' as const,
        tool_use_id: r.id,
        content: r.content,
      })),
    }
    return [anthropicMessage]
  }

  // OpenAI: each tool result is a separate message
  return results.map(r => ({
    role: 'tool' as const,
    tool_call_id: r.id,
    content: r.content,
  })) as OpenAI.ChatCompletionMessageParam[]
}
