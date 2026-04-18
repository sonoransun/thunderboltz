import { fetch as tbFetch } from '@/lib/fetch'
import type { HttpClient } from '@/lib/http'
import { createClient } from '@/lib/http'
import type { Model } from '@/types'

type Provider = NonNullable<Model['provider']>

/**
 * Default base URL for each provider. Empty string means "use per-user value"
 * (e.g., custom requires the user to supply a URL).
 */
export const defaultUrlByProvider: Partial<Record<Provider, string>> = {
  ollama: 'http://localhost:11434/v1',
  'llama-cpp': 'http://localhost:8080/v1',
  huggingface: 'https://router.huggingface.co/v1',
}

const defaultClient = (): HttpClient => createClient({ fetch: tbFetch })

/**
 * Fetch the list of models installed on a local Ollama server.
 * Ollama exposes /api/tags at the root (outside /v1), so we strip any /v1 suffix
 * from the OpenAI-style base URL before appending /api/tags.
 */
export const fetchOllamaModels = async (
  baseUrl: string,
  httpClient: HttpClient = defaultClient(),
): Promise<string[]> => {
  const root = baseUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '')
  const body = await httpClient.get(`${root}/api/tags`).json<{ models?: Array<{ name: string }> }>()
  return (body.models ?? []).map((m) => m.name).filter(Boolean)
}

/**
 * Fetch the list of models available via HuggingFace's OpenAI-compatible router.
 * Uses the router's /v1/models endpoint so we get only router-served models,
 * not the full HuggingFace catalog.
 */
export const fetchHuggingFaceRouterModels = async (
  apiKey: string,
  httpClient: HttpClient = defaultClient(),
): Promise<string[]> => {
  const body = await httpClient
    .get('https://router.huggingface.co/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    .json<{ data?: Array<{ id: string }> }>()
  return (body.data ?? []).map((m) => m.id).filter(Boolean)
}
