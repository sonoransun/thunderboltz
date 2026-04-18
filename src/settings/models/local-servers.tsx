import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, RefreshCw, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  detectLocalBinary,
  localServerStatus,
  startLocalServer,
  stopLocalServer,
  type LocalServerKind,
} from '@/lib/local-server'
import { isDesktop, isTauri } from '@/lib/platform'

type Row = {
  kind: LocalServerKind
  displayName: string
  defaultPort: number
}

const ROWS: Row[] = [
  { kind: 'ollama', displayName: 'Ollama', defaultPort: 11434 },
  { kind: 'llama-cpp', displayName: 'llama.cpp', defaultPort: 8080 },
]

/**
 * Settings subsection that lets the user start/stop the user-installed
 * Ollama or llama.cpp binaries. Only rendered on desktop Tauri builds —
 * the wrapper component is gated by isDesktop() && isTauri() before mount.
 */
export const LocalServersPanel = () => {
  if (!isDesktop() || !isTauri()) {
    return null
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Local Model Servers</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ROWS.map((row) => (
          <LocalServerRow key={row.kind} row={row} />
        ))}
      </CardContent>
    </Card>
  )
}

const LocalServerRow = ({ row }: { row: Row }) => {
  const queryClient = useQueryClient()

  const detect = useQuery({
    queryKey: ['local-binary', row.kind],
    queryFn: () => detectLocalBinary(row.kind),
    retry: false,
  })

  const status = useQuery({
    queryKey: ['local-server-status', row.kind],
    queryFn: () => localServerStatus(row.kind),
    refetchInterval: 5_000,
  })

  const start = useMutation({
    mutationFn: () => startLocalServer(row.kind, { port: row.defaultPort }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-server-status', row.kind] })
    },
  })

  const stop = useMutation({
    mutationFn: () => stopLocalServer(row.kind),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-server-status', row.kind] })
    },
  })

  const found = detect.data?.found ?? false
  const running = status.data?.running ?? false

  return (
    <div className="flex items-center justify-between border rounded-md px-3 py-2">
      <div className="flex flex-col">
        <span className="font-medium">{row.displayName}</span>
        <span className="text-xs text-muted-foreground">
          {!found && 'Not installed — install via your package manager'}
          {found && detect.data?.version && `v${detect.data.version}`}
          {found && !detect.data?.version && (detect.data?.path ?? 'Detected')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${running ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
          aria-label={running ? 'running' : 'stopped'}
        />
        {running ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => stop.mutate()}
            disabled={stop.isPending}
          >
            <Square className="h-3 w-3 mr-1" />
            Stop
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => start.mutate()}
            disabled={!found || start.isPending}
          >
            <Play className="h-3 w-3 mr-1" />
            Start
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            detect.refetch()
            status.refetch()
          }}
          aria-label="Refresh"
        >
          <RefreshCw className={detect.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>
    </div>
  )
}
