import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDatabase } from '@/contexts'
import { createModel } from '@/dal'
import { defaultUrlByProvider } from '@/lib/local-providers'
import { isDesktop, isTauri, isWebMobilePlatform } from '@/lib/platform'
import type { Model } from '@/types'
import { ModelCombobox } from './model-combobox'

const providersRequiringUrl = ['custom']
const providersRequiringApiKey = ['openai', 'anthropic', 'openrouter', 'huggingface']

const formSchema = z
  .object({
    provider: z.enum([
      'thunderbolt',
      'openai',
      'anthropic',
      'custom',
      'openrouter',
      'ollama',
      'llama-cpp',
      'huggingface',
      'huggingface-local',
    ]),
    name: z.string().min(1, { message: 'Name is required.' }),
    model: z.string().min(1, { message: 'Model name is required.' }),
    url: z.string().optional(),
    apiKey: z.string().optional(),
  })
  .refine(
    (data) => !providersRequiringUrl.includes(data.provider) || (data.url && data.url.length > 0),
    { message: 'URL is required for Custom providers', path: ['url'] },
  )
  .refine(
    (data) => !providersRequiringApiKey.includes(data.provider) || (data.apiKey && data.apiKey.length > 0),
    { message: 'API Key is required for this provider', path: ['apiKey'] },
  )

const isWebGpuAvailable = () => typeof navigator !== 'undefined' && 'gpu' in navigator

export default function NewModelPage() {
  const db = useDatabase()
  const navigate = useNavigate()
  const showLocalServers = isDesktop() && isTauri()
  const showInBrowser = isWebGpuAvailable() && !isWebMobilePlatform()

  const createModelMutation = useMutation({
    mutationFn: async (model: Omit<Model, 'id'>) => {
      const id = uuidv7()
      await createModel(db, {
        id,
        ...model,
      })
      return id
    },
    onSuccess: (id) => {
      navigate(`/settings/models/${id}`)
    },
  })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      provider: 'thunderbolt',
      name: '',
      model: '',
      url: '',
      apiKey: '',
    },
  })

  const provider = form.watch('provider')
  const url = form.watch('url') ?? ''
  const apiKey = form.watch('apiKey') ?? ''

  // Show URL field for custom + the local/compatible providers that benefit from override.
  const showUrlField = ['custom', 'ollama', 'llama-cpp', 'huggingface'].includes(provider)
  const showApiKeyField = provider !== 'huggingface-local' && provider !== 'thunderbolt'

  const handleProviderChange = (next: string) => {
    form.setValue('provider', next as z.infer<typeof formSchema>['provider'])
    const currentUrl = form.getValues('url') ?? ''
    const defaultUrl = defaultUrlByProvider[next as keyof typeof defaultUrlByProvider]
    if (defaultUrl && currentUrl.length === 0) {
      form.setValue('url', defaultUrl)
    }
  }

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createModelMutation.mutate({
      ...values,
      apiKey: values.apiKey || null,
      url: values.url || null,
      isSystem: 0,
      enabled: 1,
      toolUsage: values.provider === 'huggingface-local' || values.provider === 'ollama' || values.provider === 'llama-cpp' ? 0 : 1,
      isConfidential: 0,
      startWithReasoning: 0,
      supportsParallelToolCalls: 1,
      contextWindow: null,
      deletedAt: null,
      defaultHash: null, // User-created, not based on a default
      vendor: null,
      description: null,
      userId: null,
    })
  }

  return (
    <Card>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <FormControl>
                    <Select onValueChange={handleProviderChange} value={field.value}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="thunderbolt">Thunderbolt</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                        <SelectItem value="huggingface">HuggingFace</SelectItem>
                        {showInBrowser && (
                          <SelectItem value="huggingface-local">HuggingFace (in-browser)</SelectItem>
                        )}
                        {showLocalServers && <SelectItem value="ollama">Ollama</SelectItem>}
                        {showLocalServers && <SelectItem value="llama-cpp">llama.cpp</SelectItem>}
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <FormControl>
                    <ModelCombobox
                      provider={provider}
                      baseUrl={url}
                      apiKey={apiKey}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showUrlField && (
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL{provider !== 'custom' && <span className="text-xs text-muted-foreground"> (optional)</span>}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {showApiKeyField && (
              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key{!providersRequiringApiKey.includes(provider) && <span className="text-xs text-muted-foreground"> (optional)</span>}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" disabled={createModelMutation.isPending}>
              {createModelMutation.isPending ? 'Adding...' : 'Add Model'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
