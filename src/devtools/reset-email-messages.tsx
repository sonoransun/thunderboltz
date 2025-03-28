import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDrizzle } from '@/db/provider'
import { emailMessagesTable, emailThreadsTable, embeddingsTable } from '@/db/schema'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

export default function ResetEmailMessagesSection() {
  const [status, setStatus] = useState<string>('')
  const { db } = useDrizzle()

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      // Delete all rows from email_messages and embeddings tables
      await db.delete(emailMessagesTable).execute()
      await db.delete(emailThreadsTable).execute()
      await db.delete(embeddingsTable).execute()
      return true
    },
    onSuccess: () => {
      setStatus('Successfully deleted all email messages and embeddings.')
    },
    onError: (error) => {
      console.error('Error resetting all data:', error)
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`)
    },
  })

  const resetEmbeddingsMutation = useMutation({
    mutationFn: async () => {
      // Delete only embeddings
      await db.delete(embeddingsTable).execute()
      return true
    },
    onSuccess: () => {
      setStatus('Successfully deleted all embeddings.')
    },
    onError: (error) => {
      console.error('Error resetting embeddings:', error)
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`)
    },
  })

  const resetThreadsMutation = useMutation({
    mutationFn: async () => {
      // Delete only email threads
      // First, set email_thread_id to null for all email messages
      await db.update(emailMessagesTable).set({ emailThreadId: null }).execute()
      await db.delete(emailThreadsTable).execute()
      return true
    },
    onSuccess: () => {
      setStatus('Successfully deleted all email threads.')
    },
    onError: (error) => {
      console.error('Error resetting threads:', error)
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`)
    },
  })

  const handleResetAll = async () => {
    setStatus('Deleting all email messages and embeddings...')
    resetAllMutation.mutate()
  }

  const handleResetEmbeddings = async () => {
    setStatus('Deleting all embeddings...')
    resetEmbeddingsMutation.mutate()
  }

  const handleResetThreads = async () => {
    setStatus('Deleting all email threads...')
    resetThreadsMutation.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset Email Data</CardTitle>
        <CardDescription>Delete email messages and embeddings from the database</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button onClick={handleResetAll} disabled={resetAllMutation.isPending || resetEmbeddingsMutation.isPending || resetThreadsMutation.isPending} variant="destructive">
              {resetAllMutation.isPending ? 'Deleting...' : 'Delete All Email Data'}
            </Button>
            <Button onClick={handleResetEmbeddings} disabled={resetAllMutation.isPending || resetEmbeddingsMutation.isPending || resetThreadsMutation.isPending} variant="destructive">
              {resetEmbeddingsMutation.isPending ? 'Deleting...' : 'Delete All Embeddings'}
            </Button>
            <Button onClick={handleResetThreads} disabled={resetAllMutation.isPending || resetEmbeddingsMutation.isPending || resetThreadsMutation.isPending} variant="destructive">
              {resetThreadsMutation.isPending ? 'Deleting...' : 'Delete All Threads'}
            </Button>
          </div>
        </div>

        {status && (
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
            <div className="text-sm">{status}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
