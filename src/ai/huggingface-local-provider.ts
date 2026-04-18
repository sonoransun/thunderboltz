/**
 * Custom AI SDK v5 (LanguageModelV3) implementation that routes generation
 * through a web-llm worker. Used by the `huggingface-local` provider case
 * in src/ai/fetch.ts — the module is dynamically imported so the ~5-10 MB
 * web-llm library stays out of the main bundle.
 */

import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider'
import {
  getOrCreateWorkerClient,
  type ChatMessage,
  type WorkerClient,
} from './llm-inference-worker-client'
import { v7 as uuidv7 } from 'uuid'

type CreateHuggingFaceLocalOptions = {
  modelId: string
  workerClient?: WorkerClient
}

const toChatMessages = (prompt: LanguageModelV3Prompt): ChatMessage[] => {
  const out: ChatMessage[] = []
  for (const msg of prompt) {
    if (msg.role === 'system') {
      out.push({ role: 'system', content: msg.content })
      continue
    }
    if (msg.role === 'user' || msg.role === 'assistant') {
      const parts = msg.content as Array<{ type: string; text?: string }>
      const text = parts
        .map((p) => (p.type === 'text' && typeof p.text === 'string' ? p.text : ''))
        .join('')
      out.push({ role: msg.role, content: text })
    }
    // tool messages are dropped — huggingface-local doesn't support tool use
  }
  return out
}

const mapFinishReason = (reason: string | null): LanguageModelV3FinishReason => {
  const raw = reason ?? undefined
  switch (reason) {
    case 'stop':
      return { unified: 'stop', raw }
    case 'length':
      return { unified: 'length', raw }
    case 'tool_calls':
      return { unified: 'tool-calls', raw }
    case 'content_filter':
      return { unified: 'content-filter', raw }
    default:
      return { unified: 'other', raw }
  }
}

const buildUsage = (
  promptTokens: number | undefined,
  completionTokens: number | undefined,
) => ({
  inputTokens: {
    total: promptTokens,
    noCache: promptTokens,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: completionTokens,
    text: completionTokens,
    reasoning: undefined,
  },
})

export const createHuggingFaceLocal = (options: CreateHuggingFaceLocalOptions): LanguageModelV3 => {
  const { modelId } = options
  const client = options.workerClient ?? getOrCreateWorkerClient()

  let loadPromise: Promise<void> | null = null
  const ensureLoaded = () => {
    if (!loadPromise) {
      loadPromise = client.load(modelId)
    }
    return loadPromise
  }

  const doStream = async (opts: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> => {
    await ensureLoaded()

    const messages = toChatMessages(opts.prompt)
    const textId = uuidv7()
    let textStarted = false

    const source = client.stream(messages, {
      temperature: opts.temperature,
      maxTokens: opts.maxOutputTokens,
      signal: opts.abortSignal,
    })

    const reader = source.getReader()
    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] })
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) {
              break
            }
            if (value.type === 'delta') {
              if (!textStarted) {
                controller.enqueue({ type: 'text-start', id: textId })
                textStarted = true
              }
              controller.enqueue({ type: 'text-delta', id: textId, delta: value.content })
              continue
            }
            if (value.type === 'finish') {
              if (textStarted) {
                controller.enqueue({ type: 'text-end', id: textId })
              }
              controller.enqueue({
                type: 'finish',
                finishReason: mapFinishReason(value.finishReason),
                usage: buildUsage(value.usage?.promptTokens, value.usage?.completionTokens),
              })
            }
          }
        } catch (error) {
          controller.error(error)
          return
        }
        controller.close()
      },
      cancel: (reason) => {
        void reader.cancel(reason)
      },
    })

    return { stream }
  }

  const doGenerate = async (
    opts: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3GenerateResult> => {
    const { stream } = await doStream(opts)
    const reader = stream.getReader()
    let text = ''
    let finishReason: LanguageModelV3FinishReason = { unified: 'other', raw: undefined }
    let inputTokens: number | undefined
    let outputTokens: number | undefined
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      if (value.type === 'text-delta') {
        text += value.delta
      } else if (value.type === 'finish') {
        finishReason = value.finishReason
        inputTokens = value.usage.inputTokens.total
        outputTokens = value.usage.outputTokens.total
      }
    }
    return {
      content: [{ type: 'text', text }],
      finishReason,
      usage: buildUsage(inputTokens, outputTokens),
      warnings: [],
    }
  }

  return {
    specificationVersion: 'v3',
    provider: 'huggingface-local',
    modelId,
    supportedUrls: {},
    doGenerate,
    doStream,
  }
}
