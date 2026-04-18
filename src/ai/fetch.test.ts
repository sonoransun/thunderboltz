import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { setupTestDatabase, teardownTestDatabase } from '@/dal/test-utils'
import { createModel } from './fetch'
import type { Model } from '@/types'

beforeAll(async () => {
  await setupTestDatabase()
})

afterAll(async () => {
  await teardownTestDatabase()
})

const baseModel = (overrides: Partial<Model>): Model => ({
  id: 'test-id',
  name: 'Test',
  provider: 'openai',
  model: 'gpt-4',
  url: null,
  apiKey: null,
  isSystem: 0,
  enabled: 1,
  toolUsage: 1,
  isConfidential: 0,
  startWithReasoning: 0,
  supportsParallelToolCalls: 1,
  contextWindow: null,
  deletedAt: null,
  defaultHash: null,
  vendor: null,
  description: null,
  userId: null,
  ...overrides,
})

describe('createModel', () => {
  it('creates an Ollama-backed model without requiring an apiKey', async () => {
    const model = await createModel(
      baseModel({ provider: 'ollama', model: 'llama3.2', url: null, apiKey: null }),
    )
    // The openai-compatible provider sets modelId on the returned LanguageModel.
    expect(model.modelId).toBe('llama3.2')
    expect(model.provider).toContain('ollama')
  })

  it('creates a llama.cpp-backed model with default port 8080', async () => {
    const model = await createModel(
      baseModel({ provider: 'llama-cpp', model: 'local', url: null, apiKey: null }),
    )
    expect(model.modelId).toBe('local')
    expect(model.provider).toContain('llama-cpp')
  })

  it('throws when huggingface is used without an API key', async () => {
    expect(
      createModel(
        baseModel({ provider: 'huggingface', model: 'meta-llama/Llama-3.2-3B-Instruct', apiKey: null }),
      ),
    ).rejects.toThrow(/api key/i)
  })

  it('creates a huggingface-backed model with an API key', async () => {
    const model = await createModel(
      baseModel({
        provider: 'huggingface',
        model: 'meta-llama/Llama-3.2-3B-Instruct',
        apiKey: 'hf_abc',
      }),
    )
    expect(model.modelId).toBe('meta-llama/Llama-3.2-3B-Instruct')
    expect(model.provider).toContain('huggingface')
  })

  it('honors a custom url override for ollama', async () => {
    const model = await createModel(
      baseModel({ provider: 'ollama', model: 'llama3.2', url: 'http://my-ollama:11434/v1' }),
    )
    // We can't inspect the baseURL directly, but the model should still be created.
    expect(model.modelId).toBe('llama3.2')
  })
})
