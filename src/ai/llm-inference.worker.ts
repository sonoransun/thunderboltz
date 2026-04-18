/// <reference lib="webworker" />

/**
 * Dedicated Worker for in-browser LLM inference via @mlc-ai/web-llm.
 *
 * Protocol (messages to the worker):
 *   { type: 'load', modelId, requestId }
 *   { type: 'generate', messages, options, requestId }
 *   { type: 'abort', requestId }
 *   { type: 'unload' }
 *
 * Protocol (messages from the worker):
 *   { type: 'progress', requestId, text, progress }
 *   { type: 'ready', requestId }
 *   { type: 'chunk', requestId, delta }
 *   { type: 'finish', requestId, finishReason, usage }
 *   { type: 'error', requestId, message }
 */

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type IncomingMessage =
  | { type: 'load'; modelId: string; requestId: string }
  | {
      type: 'generate'
      requestId: string
      messages: ChatMessage[]
      options?: {
        temperature?: number
        maxTokens?: number
      }
    }
  | { type: 'abort'; requestId: string }
  | { type: 'unload' }

type WebLLMEngine = {
  reload: (modelId: string) => Promise<void>
  chat: {
    completions: {
      create: (args: {
        messages: ChatMessage[]
        stream: true
        temperature?: number
        max_tokens?: number
      }) => AsyncIterable<{
        choices: Array<{ delta?: { content?: string }; finish_reason?: string | null }>
        usage?: { prompt_tokens: number; completion_tokens: number }
      }>
    }
  }
  interruptGenerate: () => void
  unload: () => Promise<void>
}

let engine: WebLLMEngine | null = null
let currentModelId: string | null = null
let activeRequestId: string | null = null

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

const post = (message: unknown) => ctx.postMessage(message)

const ensureEngine = async (modelId: string, requestId: string) => {
  const webllm = await import('@mlc-ai/web-llm')
  if (!engine) {
    engine = (await webllm.CreateMLCEngine(modelId, {
      initProgressCallback: (p: { text: string; progress: number }) =>
        post({ type: 'progress', requestId, text: p.text, progress: p.progress }),
    })) as unknown as WebLLMEngine
    currentModelId = modelId
    return
  }
  if (currentModelId !== modelId) {
    await engine.reload(modelId)
    currentModelId = modelId
  }
}

const handleGenerate = async (msg: Extract<IncomingMessage, { type: 'generate' }>) => {
  if (!engine || !currentModelId) {
    post({ type: 'error', requestId: msg.requestId, message: 'Engine not loaded' })
    return
  }
  activeRequestId = msg.requestId
  try {
    const stream = await engine.chat.completions.create({
      messages: msg.messages,
      stream: true,
      temperature: msg.options?.temperature,
      max_tokens: msg.options?.maxTokens,
    })

    let finishReason: string | null = null
    let usage: { prompt_tokens: number; completion_tokens: number } | undefined
    for await (const chunk of stream) {
      if (activeRequestId !== msg.requestId) {
        break
      }
      const choice = chunk.choices[0]
      const delta = choice?.delta?.content
      if (delta) {
        post({ type: 'chunk', requestId: msg.requestId, delta })
      }
      if (choice?.finish_reason) {
        finishReason = choice.finish_reason
      }
      if (chunk.usage) {
        usage = chunk.usage
      }
    }
    post({ type: 'finish', requestId: msg.requestId, finishReason, usage })
  } catch (error) {
    post({
      type: 'error',
      requestId: msg.requestId,
      message: error instanceof Error ? error.message : String(error),
    })
  } finally {
    if (activeRequestId === msg.requestId) {
      activeRequestId = null
    }
  }
}

ctx.addEventListener('message', (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data
  switch (msg.type) {
    case 'load':
      ensureEngine(msg.modelId, msg.requestId)
        .then(() => post({ type: 'ready', requestId: msg.requestId }))
        .catch((error) =>
          post({
            type: 'error',
            requestId: msg.requestId,
            message: error instanceof Error ? error.message : String(error),
          }),
        )
      return
    case 'generate':
      void handleGenerate(msg)
      return
    case 'abort':
      if (activeRequestId === msg.requestId && engine) {
        engine.interruptGenerate()
        activeRequestId = null
      }
      return
    case 'unload':
      void engine?.unload()
      engine = null
      currentModelId = null
      activeRequestId = null
      return
  }
})

export {}
