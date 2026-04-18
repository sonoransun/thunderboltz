/**
 * Curated list of models supported by the in-browser HuggingFace provider.
 * Model IDs match @mlc-ai/web-llm's prebuilt config. Sizes are approximate
 * quantized download sizes in bytes — shown in the UI as "download required".
 */
export type LocalModelEntry = {
  id: string
  displayName: string
  sizeBytes: number
  minVramGb: number
}

export const supportedLocalModels: ReadonlyArray<LocalModelEntry> = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    displayName: 'Llama 3.2 1B Instruct',
    sizeBytes: 879_000_000,
    minVramGb: 2,
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
    displayName: 'Llama 3.2 3B Instruct',
    sizeBytes: 2_260_000_000,
    minVramGb: 4,
  },
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    displayName: 'Qwen 2.5 0.5B Instruct',
    sizeBytes: 430_000_000,
    minVramGb: 2,
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    displayName: 'Qwen 2.5 1.5B Instruct',
    sizeBytes: 1_100_000_000,
    minVramGb: 3,
  },
  {
    id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    displayName: 'Qwen 2.5 7B Instruct',
    sizeBytes: 4_500_000_000,
    minVramGb: 6,
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    displayName: 'Phi 3.5 Mini Instruct',
    sizeBytes: 2_100_000_000,
    minVramGb: 4,
  },
] as const

export const isSupportedLocalModel = (id: string): boolean =>
  supportedLocalModels.some((m) => m.id === id)
