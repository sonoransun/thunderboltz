/**
 * Frontend wrapper around the Tauri sidecar commands defined in
 * `src-tauri/src/local_server.rs`. Gracefully degrades when not in a
 * desktop Tauri environment (mobile / web) — returns `{ found: false }`
 * or `{ running: false }` so the UI can render without conditional guards
 * everywhere.
 */

import { isDesktop, isTauri } from '@/lib/platform'

export type LocalServerKind = 'ollama' | 'llama-cpp'

export type DetectResult = {
  found: boolean
  path?: string
  version?: string
}

export type StartResult = {
  pid: number
  url: string
}

export type StatusResult = {
  running: boolean
  pid?: number
  url?: string
}

export type StartOptions = {
  port?: number
  model_dir?: string
  extra_args?: string[]
}

const isSupported = (): boolean => isTauri() && isDesktop()

const invokeCmd = async <T>(cmd: string, args: Record<string, unknown>): Promise<T> => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export const detectLocalBinary = async (kind: LocalServerKind): Promise<DetectResult> => {
  if (!isSupported()) {
    return { found: false }
  }
  return invokeCmd<DetectResult>('detect_local_binary', { kind })
}

export const startLocalServer = async (
  kind: LocalServerKind,
  options?: StartOptions,
): Promise<StartResult> => {
  if (!isSupported()) {
    throw new Error('Local servers are only supported on desktop')
  }
  return invokeCmd<StartResult>('start_local_server', { kind, options: options ?? null })
}

export const stopLocalServer = async (kind: LocalServerKind): Promise<void> => {
  if (!isSupported()) {
    return
  }
  await invokeCmd<void>('stop_local_server', { kind })
}

export const localServerStatus = async (kind: LocalServerKind): Promise<StatusResult> => {
  if (!isSupported()) {
    return { running: false }
  }
  return invokeCmd<StatusResult>('local_server_status', { kind })
}
