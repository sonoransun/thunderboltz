/**
 * Frontend-side wrapper around the LLM inference worker.
 * Lazily instantiates a single Worker per tab. Translates the worker's
 * message protocol into promises and ReadableStreams.
 */

import { v7 as uuidv7 } from 'uuid'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type GenerateOptions = {
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  onProgress?: (p: { text: string; progress: number }) => void
}

export type StreamChunk =
  | { type: 'delta'; content: string }
  | { type: 'finish'; finishReason: string | null; usage?: { promptTokens: number; completionTokens: number } }

type WorkerInMessage =
  | { type: 'progress'; requestId: string; text: string; progress: number }
  | { type: 'ready'; requestId: string }
  | { type: 'chunk'; requestId: string; delta: string }
  | { type: 'finish'; requestId: string; finishReason: string | null; usage?: { prompt_tokens: number; completion_tokens: number } }
  | { type: 'error'; requestId: string; message: string }

export type WorkerClient = {
  load: (modelId: string, onProgress?: (p: { text: string; progress: number }) => void) => Promise<void>
  stream: (messages: ChatMessage[], options?: GenerateOptions) => ReadableStream<StreamChunk>
  unload: () => void
  terminate: () => void
}

export const isWebGPUAvailable = (): boolean => typeof navigator !== 'undefined' && 'gpu' in navigator

const createWorker = (): Worker =>
  new Worker(new URL('./llm-inference.worker.ts', import.meta.url), { type: 'module' })

/**
 * Build a WorkerClient. Accepts an injected `workerFactory` so tests can pass a fake.
 */
export const createWorkerClient = (workerFactory: () => Worker = createWorker): WorkerClient => {
  const worker = workerFactory()
  const pending = new Map<
    string,
    {
      resolve?: () => void
      reject?: (error: Error) => void
      controller?: ReadableStreamDefaultController<StreamChunk>
      onProgress?: (p: { text: string; progress: number }) => void
    }
  >()

  worker.addEventListener('message', (event: MessageEvent<WorkerInMessage>) => {
    const msg = event.data
    const entry = pending.get(msg.requestId)
    if (!entry) {
      return
    }
    switch (msg.type) {
      case 'progress':
        entry.onProgress?.({ text: msg.text, progress: msg.progress })
        return
      case 'ready':
        entry.resolve?.()
        pending.delete(msg.requestId)
        return
      case 'chunk':
        entry.controller?.enqueue({ type: 'delta', content: msg.delta })
        return
      case 'finish':
        entry.controller?.enqueue({
          type: 'finish',
          finishReason: msg.finishReason,
          usage: msg.usage
            ? { promptTokens: msg.usage.prompt_tokens, completionTokens: msg.usage.completion_tokens }
            : undefined,
        })
        entry.controller?.close()
        pending.delete(msg.requestId)
        return
      case 'error':
        if (entry.controller) {
          entry.controller.error(new Error(msg.message))
        } else {
          entry.reject?.(new Error(msg.message))
        }
        pending.delete(msg.requestId)
        return
    }
  })

  return {
    load: (modelId, onProgress) =>
      new Promise<void>((resolve, reject) => {
        const requestId = uuidv7()
        pending.set(requestId, { resolve, reject, onProgress })
        worker.postMessage({ type: 'load', modelId, requestId })
      }),

    stream: (messages, options = {}) => {
      const requestId = uuidv7()
      return new ReadableStream<StreamChunk>({
        start: (controller) => {
          pending.set(requestId, { controller, onProgress: options.onProgress })
          worker.postMessage({
            type: 'generate',
            requestId,
            messages,
            options: { temperature: options.temperature, maxTokens: options.maxTokens },
          })
          options.signal?.addEventListener('abort', () => {
            worker.postMessage({ type: 'abort', requestId })
          })
        },
        cancel: () => {
          worker.postMessage({ type: 'abort', requestId })
          pending.delete(requestId)
        },
      })
    },

    unload: () => worker.postMessage({ type: 'unload' }),
    terminate: () => {
      worker.terminate()
      pending.clear()
    },
  }
}

let singleton: WorkerClient | null = null

export const getOrCreateWorkerClient = (): WorkerClient => {
  if (!singleton) {
    singleton = createWorkerClient()
  }
  return singleton
}
