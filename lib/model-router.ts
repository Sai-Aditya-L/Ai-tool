export type TaskType =
  | 'simple'        // quick answers, summaries → haiku
  | 'chat'          // normal conversation → sonnet
  | 'coding'        // code gen/review → sonnet
  | 'vision'        // image analysis → sonnet (has vision)
  | 'planning'      // complex reasoning, simulations → sonnet
  | 'research'      // deep research → sonnet
  | 'translation'   // translate text → haiku (fast)
  | 'agent'         // agent runs → sonnet
  | 'orchestration' // master orchestrator → sonnet

export interface ModelConfig {
  model: string
  maxTokens: number
  estimatedCostPer1kInput: number   // in USD
  estimatedCostPer1kOutput: number
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'claude-haiku-4-5-20251001': {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 4096,
    estimatedCostPer1kInput: 0.00025,
    estimatedCostPer1kOutput: 0.00125,
  },
  'claude-sonnet-4-6': {
    model: 'claude-sonnet-4-6',
    maxTokens: 8192,
    estimatedCostPer1kInput: 0.003,
    estimatedCostPer1kOutput: 0.015,
  },
}

const TASK_MODEL_MAP: Record<TaskType, string> = {
  simple: 'claude-haiku-4-5-20251001',
  chat: 'claude-sonnet-4-6',
  coding: 'claude-sonnet-4-6',
  vision: 'claude-sonnet-4-6',
  planning: 'claude-sonnet-4-6',
  research: 'claude-sonnet-4-6',
  translation: 'claude-haiku-4-5-20251001',
  agent: 'claude-sonnet-4-6',
  orchestration: 'claude-sonnet-4-6',
}

export function routeModel(taskType: TaskType): ModelConfig {
  const modelId = TASK_MODEL_MAP[taskType]
  return MODEL_CONFIGS[modelId]
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const config = MODEL_CONFIGS[model]
  if (!config) return 0
  return (inputTokens / 1000) * config.estimatedCostPer1kInput +
         (outputTokens / 1000) * config.estimatedCostPer1kOutput
}

export function getModelDisplayName(model: string): string {
  const names: Record<string, string> = {
    'claude-haiku-4-5-20251001': 'Claude Haiku (Fast)',
    'claude-sonnet-4-6': 'Claude Sonnet (Standard)',
  }
  return names[model] || model
}

export { MODEL_CONFIGS, TASK_MODEL_MAP }
