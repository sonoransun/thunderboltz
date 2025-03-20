import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDrizzle } from '@/db/provider'
import { emailMessagesTable, embeddingsTable } from '@/db/schema'
import { generateEmbeddings } from '@/lib/embeddings'
import { count } from 'drizzle-orm'
import { useEffect, useState } from 'react'

export default function GenerateEmbeddingsSection() {
  const { db } = useDrizzle()
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [batchSize, setBatchSize] = useState<number>(100)
  const [status, setStatus] = useState<string>('')
  const [progress, setProgress] = useState<{ embeddings: number; emails: number }>({ embeddings: 0, emails: 0 })

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const [emailsResult] = await db.select({ value: count() }).from(emailMessagesTable)
        const [embeddingsResult] = await db.select({ value: count() }).from(embeddingsTable)

        setProgress({
          emails: emailsResult.value,
          embeddings: embeddingsResult.value,
        })
      } catch (error) {
        console.error('Error fetching progress:', error)
      }
    }

    fetchProgress()
  }, [db])

  const handleGenerateEmbeddings = async () => {
    setIsGenerating(true)
    setStatus('Generating embeddings...')
    try {
      await generateEmbeddings(batchSize)
      setStatus('Embeddings generated successfully!')

      // Refresh progress after generation
      const [emailsResult] = await db.select({ value: count() }).from(emailMessagesTable)
      const [embeddingsResult] = await db.select({ value: count() }).from(embeddingsTable)

      setProgress({
        emails: emailsResult.value,
        embeddings: embeddingsResult.value,
      })
    } catch (error) {
      console.error('Error generating embeddings:', error)
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const progressPercentage = progress.emails > 0 ? Math.min(100, Math.round((progress.embeddings / progress.emails) * 100)) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Embeddings</CardTitle>
        <CardDescription>Generate embeddings for email messages in the database</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Button onClick={handleGenerateEmbeddings} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate Embeddings'}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Batch Size:</span>
            <input type="number" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="w-20 p-1 text-sm border rounded" min="1" max="1000" disabled={isGenerating} />
          </div>
        </div>

        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-in-out" style={{ width: `${progressPercentage}%` }}></div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
          {progress.embeddings} of {progress.emails} emails have embeddings ({progressPercentage}%)
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
