import { DatabaseSingleton } from '@/db/singleton'
import { modelsTable, settingsTable } from '@/db/tables'
import { Model, SaveMessagesFunction } from '@/types'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
// import { createOpenRouter } from '@openrouter/ai-sdk-provider' // TODO: Use when AI SDK v2 branch is stable

import { stripTagsMiddleware } from '@/ai/middleware/strip-tags'
import { createPrompt } from '@/ai/prompt'
import { getCloudUrl } from '@/lib/config'
import { fetch } from '@/lib/fetch'
import { handleFlowerChatStream } from '@/lib/flower'
import { createToolset, getAvailableTools } from '@/lib/tools'
import {
  convertToModelMessages,
  experimental_createMCPClient,
  extractReasoningMiddleware,
  LanguageModel,
  streamText,
  ToolInvocation,
  UIMessage,
  wrapLanguageModel,
  type ToolSet,
} from 'ai'
import { eq } from 'drizzle-orm'

export type ToolInvocationWithResult<T = object> = ToolInvocation & {
  result: T
}

export type MCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>

export const ollama = createOpenAI({
  baseURL: 'http://localhost:11434/v1',
  // compatibility: 'compatible',
  apiKey: 'ollama',
  fetch,
})

type AiFetchStreamingResponseOptions = {
  init: RequestInit
  saveMessages: SaveMessagesFunction
  modelId: string
  mcpClients?: MCPClient[]
}

export const createModel = async (modelConfig: Model): Promise<LanguageModel> => {
  switch (modelConfig.provider) {
    case 'thunderbolt': {
      const cloudUrl = await getCloudUrl()
      const openaiCompatible = createOpenAICompatible({
        name: 'custom',
        baseURL: `${cloudUrl}/openai`,
        fetch,
      })
      return openaiCompatible(modelConfig.model) as LanguageModel
    }
    case 'openai': {
      if (!modelConfig.apiKey) throw new Error('No API key provided')
      const openai = createOpenAI({
        apiKey: modelConfig.apiKey,
        fetch,
      })
      return openai(modelConfig.model)
    }
    case 'custom': {
      if (!modelConfig.url) throw new Error('No URL provided for custom provider')
      const openaiCompatible = createOpenAICompatible({
        name: 'custom',
        baseURL: modelConfig.url,
        apiKey: modelConfig.apiKey || undefined,
        fetch,
      })
      return openaiCompatible(modelConfig.model) as LanguageModel
    }
    case 'openrouter': {
      if (!modelConfig.apiKey) throw new Error('No API key provided')
      // Using OpenAI-compatible approach until OpenRouter SDK v2 branch is stable
      // https://github.com/OpenRouterTeam/ai-sdk-provider/pull/77
      const openrouter = createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: modelConfig.apiKey,
        fetch,
      })
      return openrouter(modelConfig.model) as LanguageModel
    }
    default:
      throw new Error(`Unsupported provider: ${modelConfig.provider}`)
  }
}

export const aiFetchStreamingResponse = async ({
  init,
  saveMessages,
  modelId,
  mcpClients,
}: AiFetchStreamingResponseOptions) => {
  try {
    const options = init as RequestInit & { body: string }
    const body = JSON.parse(options.body)
    const abortSignal: AbortSignal | undefined = options.signal ?? undefined

    const { messages, chatId } = body as { messages: UIMessage[]; chatId: string }

    await saveMessages({ id: chatId, messages })

    const db = DatabaseSingleton.instance.db

    const locationNameResult = await db.select().from(settingsTable).where(eq(settingsTable.key, 'location_name')).get()
    const locationLatResult = await db.select().from(settingsTable).where(eq(settingsTable.key, 'location_lat')).get()
    const locationLngResult = await db.select().from(settingsTable).where(eq(settingsTable.key, 'location_lng')).get()
    const preferredNameResult = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, 'preferred_name'))
      .get()

    const model = await db.query.modelsTable.findFirst({
      where: eq(modelsTable.id, modelId),
    })

    if (!model) throw new Error('Model not found')

    const supportsTools = model.toolUsage !== 0

    let toolset: ToolSet = {}
    if (supportsTools) {
      const availableTools = await getAvailableTools()
      toolset = { ...createToolset(availableTools) }

      if (mcpClients && mcpClients.length > 0) {
        try {
          for (const mcpClient of mcpClients) {
            const mcpTools = await mcpClient.tools()
            Object.assign(toolset, mcpTools)
          }
          console.log(`MCP tools loaded successfully from ${mcpClients.length} clients`)
        } catch (error) {
          console.error('Failed to load MCP tools:', error)
        }
      } else {
        console.warn('No MCP clients available, MCP tools will not be included')
      }
    } else {
      console.log('Model does not support tools, skipping tool setup')
    }

    const systemPrompt = createPrompt({
      preferredName: preferredNameResult?.value as string,
      location: {
        name: locationNameResult?.value as string,
        lat: locationLatResult?.value
          ? typeof locationLatResult.value === 'number'
            ? locationLatResult.value
            : parseFloat(locationLatResult.value as string)
          : undefined,
        lng: locationLngResult?.value
          ? typeof locationLngResult.value === 'number'
            ? locationLngResult.value
            : parseFloat(locationLngResult.value as string)
          : undefined,
      },
    })

    // Flower is a special case that uses a custom SDK that is not compatible with the Vercel AI SDK.
    if (model.provider === 'flower') {
      const tools = model.toolUsage === 1 ? await getAvailableTools() : undefined
      return handleFlowerChatStream({ messages, systemPrompt, model: model.model, tools })
    }

    const baseModel = await createModel(model)

    const wrappedModel = wrapLanguageModel({
      model: baseModel,
      middleware: [stripTagsMiddleware, extractReasoningMiddleware({ tagName: 'think' })],
    })

    const result = streamText({
      model: wrappedModel,
      system: systemPrompt,
      messages: convertToModelMessages(messages),
      toolCallStreaming: supportsTools,
      tools: supportsTools ? toolset : undefined,
      maxSteps: 10,
      abortSignal,
    })

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      // Attach the modelId as metadata so the client knows which model was used
      messageMetadata: () => ({ modelId }),
    })
  } catch (error) {
    console.error('Error in aiFetchStreamingResponse:', error)
    throw error
  }
}
