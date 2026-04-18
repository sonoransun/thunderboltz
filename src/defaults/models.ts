import { hashValues } from '@/lib/utils'
import type { Model } from '@/types'

/**
 * Compute hash of user-editable fields for a model
 * Includes deletedAt to treat soft-delete as a user configuration choice
 */
export const hashModel = (model: Model): string => {
  return hashValues([
    model.name,
    model.provider,
    model.model,
    model.url,
    model.apiKey,
    model.isSystem,
    model.enabled,
    model.toolUsage,
    model.isConfidential,
    model.startWithReasoning,
    model.supportsParallelToolCalls,
    model.contextWindow,
    model.deletedAt,
  ])
}

/**
 * Default system models shipped with the application
 * These are upserted on app start and serve as the baseline for diff comparisons
 *
 * Each model is exported individually so it can be referenced by automations
 */
export const defaultModelGptOss120b: Model = {
  id: 'd045a4c0-3f93-4f30-a608-24e07856e11d',
  name: 'GPT OSS',
  provider: 'thunderbolt',
  model: 'gpt-oss-120b',
  isSystem: 1,
  enabled: 1,
  isConfidential: 1,
  contextWindow: 131072,
  toolUsage: 1,
  startWithReasoning: 0,
  supportsParallelToolCalls: 1,
  deletedAt: null,
  apiKey: null,
  url: null,
  defaultHash: null,
  vendor: 'openai',
  description: 'Fast and confidential',
  userId: null,
}

export const defaultModelMistralMedium31: Model = {
  id: '019af08a-9836-783d-ab56-39b9fec48af1',
  name: 'Mistral Medium 3.1',
  provider: 'thunderbolt',
  model: 'mistral-medium-3.1',
  isSystem: 1,
  enabled: 1,
  isConfidential: 0,
  contextWindow: 131072,
  toolUsage: 1,
  startWithReasoning: 0,
  supportsParallelToolCalls: 0,
  deletedAt: null,
  apiKey: null,
  url: null,
  defaultHash: null,
  vendor: 'mistral',
  description: 'Balanced performance and efficiency',
  userId: null,
}

export const defaultModelSonnet45: Model = {
  id: '019af08a-c27b-7074-8aac-95315d1ef3fd',
  name: 'Sonnet 4.5',
  provider: 'thunderbolt',
  model: 'sonnet-4.5',
  isSystem: 1,
  enabled: 1,
  isConfidential: 0,
  contextWindow: 200000,
  toolUsage: 1,
  startWithReasoning: 0,
  supportsParallelToolCalls: 1,
  deletedAt: null,
  apiKey: null,
  url: null,
  defaultHash: null,
  vendor: 'anthropic',
  description: 'Advanced reasoning and creativity',
  userId: null,
}

export const defaultModelOllamaLlama32: Model = {
  id: '019da1e7-3b00-70fa-8c2e-4a5b6c7d8e91',
  name: 'Ollama · Llama 3.2',
  provider: 'ollama',
  model: 'llama3.2',
  isSystem: 1,
  enabled: 0,
  isConfidential: 1,
  contextWindow: 131072,
  toolUsage: 0,
  startWithReasoning: 0,
  supportsParallelToolCalls: 0,
  deletedAt: null,
  apiKey: null,
  url: null,
  defaultHash: null,
  vendor: null,
  description: 'Runs locally via Ollama',
  userId: null,
}

export const defaultModelLlamaCpp: Model = {
  id: '019da1e7-3b01-7b13-99d4-7f3e2c1a0b88',
  name: 'llama.cpp · Local',
  provider: 'llama-cpp',
  model: 'local',
  isSystem: 1,
  enabled: 0,
  isConfidential: 1,
  contextWindow: null,
  toolUsage: 0,
  startWithReasoning: 0,
  supportsParallelToolCalls: 0,
  deletedAt: null,
  apiKey: null,
  url: null,
  defaultHash: null,
  vendor: null,
  description: 'Runs locally via llama.cpp',
  userId: null,
}

export const defaultModelHuggingFaceRouter: Model = {
  id: '019da1e7-3b02-7c86-a3f1-5e8d2b4c6a79',
  name: 'HuggingFace · Llama 3.2 3B',
  provider: 'huggingface',
  model: 'meta-llama/Llama-3.2-3B-Instruct',
  isSystem: 1,
  enabled: 0,
  isConfidential: 0,
  contextWindow: 131072,
  toolUsage: 1,
  startWithReasoning: 0,
  supportsParallelToolCalls: 0,
  deletedAt: null,
  apiKey: null,
  url: null,
  defaultHash: null,
  vendor: null,
  description: 'HuggingFace Inference Router',
  userId: null,
}

export const defaultModelHuggingFaceLocalLlama323B: Model = {
  id: '019da1e7-3b03-7d42-b07e-9a3c1f5e8b44',
  name: 'HuggingFace (in-browser) · Llama 3.2 3B',
  provider: 'huggingface-local',
  model: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
  isSystem: 1,
  enabled: 0,
  isConfidential: 1,
  contextWindow: 4096,
  toolUsage: 0,
  startWithReasoning: 0,
  supportsParallelToolCalls: 0,
  deletedAt: null,
  apiKey: null,
  url: null,
  defaultHash: null,
  vendor: null,
  description: 'Runs entirely in your browser (WebGPU)',
  userId: null,
}

/**
 * Array of all default models for iteration
 */
export const defaultModels: ReadonlyArray<Model> = [
  defaultModelGptOss120b,
  defaultModelMistralMedium31,
  defaultModelSonnet45,
  defaultModelOllamaLlama32,
  defaultModelLlamaCpp,
  defaultModelHuggingFaceRouter,
  defaultModelHuggingFaceLocalLlama323B,
] as const
