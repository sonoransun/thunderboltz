import { describe, expect, it, mock } from 'bun:test'
import { fetchHuggingFaceRouterModels, fetchOllamaModels } from './local-providers'
import type { HttpClient, ResponsePromise } from './http'

const makeClient = (body: unknown): HttpClient => {
  const respond = (): ResponsePromise => {
    const response = new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    const promise = Promise.resolve(response) as ResponsePromise
    promise.json = <T>() => Promise.resolve(body as T)
    promise.text = () => Promise.resolve(JSON.stringify(body))
    return promise
  }
  return {
    get: mock(() => respond()),
    post: mock(() => respond()),
    delete: mock(() => respond()),
  }
}

describe('fetchOllamaModels', () => {
  it('parses the /api/tags response', async () => {
    const client = makeClient({
      models: [{ name: 'llama3.2' }, { name: 'qwen2.5' }],
    })
    const names = await fetchOllamaModels('http://localhost:11434/v1', client)
    expect(names).toEqual(['llama3.2', 'qwen2.5'])
  })

  it('strips /v1 suffix before hitting /api/tags', async () => {
    const get = mock(() => {
      const body = { models: [] }
      const p = Promise.resolve(new Response(JSON.stringify(body))) as ResponsePromise
      p.json = <T>() => Promise.resolve(body as T)
      p.text = () => Promise.resolve('')
      return p
    })
    const client: HttpClient = {
      get,
      post: mock(() => Promise.resolve(new Response()) as ResponsePromise),
      delete: mock(() => Promise.resolve(new Response()) as ResponsePromise),
    }
    await fetchOllamaModels('http://localhost:11434/v1/', client)
    expect(get).toHaveBeenCalledWith('http://localhost:11434/api/tags')
  })

  it('tolerates missing models array', async () => {
    const client = makeClient({})
    const names = await fetchOllamaModels('http://localhost:11434', client)
    expect(names).toEqual([])
  })
})

describe('fetchHuggingFaceRouterModels', () => {
  it('parses OpenAI-shaped data list', async () => {
    const client = makeClient({
      data: [{ id: 'meta-llama/Llama-3.2-3B-Instruct' }, { id: 'Qwen/Qwen2.5-7B-Instruct' }],
    })
    const ids = await fetchHuggingFaceRouterModels('hf_token', client)
    expect(ids).toEqual(['meta-llama/Llama-3.2-3B-Instruct', 'Qwen/Qwen2.5-7B-Instruct'])
  })

  it('sends the Bearer token', async () => {
    const get = mock(() => {
      const body = { data: [] }
      const p = Promise.resolve(new Response(JSON.stringify(body))) as ResponsePromise
      p.json = <T>() => Promise.resolve(body as T)
      p.text = () => Promise.resolve('')
      return p
    })
    const client: HttpClient = {
      get,
      post: mock(() => Promise.resolve(new Response()) as ResponsePromise),
      delete: mock(() => Promise.resolve(new Response()) as ResponsePromise),
    }
    await fetchHuggingFaceRouterModels('hf_abc', client)
    expect(get).toHaveBeenCalledWith('https://router.huggingface.co/v1/models', {
      headers: { Authorization: 'Bearer hf_abc' },
    })
  })
})
