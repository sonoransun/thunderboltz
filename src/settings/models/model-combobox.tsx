import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { supportedLocalModels } from '@/ai/huggingface-local-models'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxItem } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { fetchHuggingFaceRouterModels, fetchOllamaModels } from '@/lib/local-providers'
import type { Model } from '@/types'

type Provider = NonNullable<Model['provider']>

type Props = {
  provider: Provider
  baseUrl: string | null | undefined
  apiKey: string | null | undefined
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}

/**
 * Input with model discovery for providers that support it.
 *
 * - `ollama` / `huggingface` — fetches a list and shows a searchable combobox
 *   backed by free-text entry (user can still type a model name not on the list).
 * - `huggingface-local` — renders the curated supportedLocalModels list.
 * - Anything else — plain `<Input>`.
 */
export const ModelCombobox = ({ provider, baseUrl, apiKey, value, onChange, disabled }: Props) => {
  const [manualEntry, setManualEntry] = useState(false)

  if (provider === 'huggingface-local') {
    const items: ComboboxItem[] = supportedLocalModels.map((m) => ({
      id: m.id,
      label: m.displayName,
      description: `${(m.sizeBytes / 1e9).toFixed(1)} GB · ${m.minVramGb} GB VRAM`,
    }))
    return (
      <Combobox
        items={items}
        value={value}
        onValueChange={onChange}
        placeholder="Select a model"
        disabled={disabled}
      />
    )
  }

  const isDiscoverable = provider === 'ollama' || provider === 'huggingface'

  if (!isDiscoverable || manualEntry) {
    return (
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
        {isDiscoverable && (
          <Button type="button" variant="outline" size="sm" onClick={() => setManualEntry(false)}>
            Discover
          </Button>
        )}
      </div>
    )
  }

  return (
    <DiscoveryCombobox
      provider={provider}
      baseUrl={baseUrl ?? ''}
      apiKey={apiKey ?? ''}
      value={value}
      onChange={onChange}
      onManualEntry={() => setManualEntry(true)}
      disabled={disabled}
    />
  )
}

type DiscoveryProps = {
  provider: 'ollama' | 'huggingface'
  baseUrl: string
  apiKey: string
  value: string
  onChange: (next: string) => void
  onManualEntry: () => void
  disabled?: boolean
}

const DiscoveryCombobox = ({
  provider,
  baseUrl,
  apiKey,
  value,
  onChange,
  onManualEntry,
  disabled,
}: DiscoveryProps) => {
  const enabled =
    provider === 'ollama' ? baseUrl.length > 0 : apiKey.length > 0

  const query = useQuery({
    queryKey: ['discover-models', provider, baseUrl, apiKey.length > 0],
    queryFn: async () => {
      if (provider === 'ollama') {
        return fetchOllamaModels(baseUrl)
      }
      return fetchHuggingFaceRouterModels(apiKey)
    },
    enabled,
    retry: false,
    staleTime: 60_000,
  })

  const items: ComboboxItem[] = (query.data ?? []).map((id) => ({ id, label: id }))
  // If the current value isn't in the list, include it so the combobox shows it.
  if (value && !items.some((i) => i.id === value)) {
    items.unshift({ id: value, label: value })
  }

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <Combobox
          items={items}
          value={value}
          onValueChange={onChange}
          placeholder={query.isLoading ? 'Loading…' : 'Select a model'}
          emptyMessage={
            query.isError
              ? 'Could not reach server — try manual entry'
              : enabled
                ? 'No models found'
                : provider === 'ollama'
                  ? 'Set a URL to discover'
                  : 'Set an API key to discover'
          }
          loading={query.isLoading}
          disabled={disabled}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => query.refetch()}
        disabled={!enabled || disabled || query.isFetching}
        aria-label="Refresh"
      >
        <RefreshCw className={query.isFetching ? 'animate-spin' : ''} />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onManualEntry}>
        Enter manually
      </Button>
    </div>
  )
}
