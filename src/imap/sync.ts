import { emailMessagesTable } from '@/db/schema'
import { DrizzleContextType, EmailMessage, ParsedEmail } from '@/types'
import { count } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import ImapClient from './imap'

/**
 * **ImapSyncer**
 *
 * The `ImapSyncer` class manages the syncing state of IMAP mailboxes.
 * It fetches messages from a specified mailbox and stores them in the database.
 */
export class ImapSyncer {
  private db: DrizzleContextType['db']
  private mailbox: string
  private pageSize: number
  private isSyncing: boolean
  private shouldCancelAfterNextBatch: boolean
  private messagesProcessed: number
  private totalMessages: number
  private messagesSynced: number
  private imapClient: ImapClient

  /**
   * Creates a new ImapSyncer instance
   * @param db Database connection
   * @param mailbox The mailbox to sync (default: 'All Mail')
   * @param pageSize Number of messages to fetch in each batch (default: 50)
   */
  constructor(db: DrizzleContextType['db'], mailbox: string = 'All Mail', pageSize: number = 50) {
    this.db = db
    this.mailbox = mailbox
    this.pageSize = pageSize
    this.isSyncing = false
    this.shouldCancelAfterNextBatch = false
    this.messagesProcessed = 0
    this.totalMessages = 0
    this.messagesSynced = 0
    this.imapClient = new ImapClient()
  }

  /**
   * Cancels the syncing process after the current batch completes
   */
  cancel(): void {
    this.shouldCancelAfterNextBatch = true
  }

  /**
   * Get the current syncing status
   * @returns An object containing the current syncing status
   */
  getStatus(): { messagesProcessed: number; messagesSynced: number; totalMessages: number; isSyncing: boolean; progress: number } {
    return {
      messagesProcessed: this.messagesProcessed,
      messagesSynced: this.messagesSynced,
      totalMessages: this.totalMessages,
      isSyncing: this.isSyncing,
      progress: this.totalMessages > 0 ? (this.messagesSynced / this.totalMessages) * 100 : 0,
    }
  }

  async syncPage(startIndex: number, pageSize: number, since?: Date): Promise<{ hasMoreMessages: boolean }> {
    const result = await this.imapClient.fetchMessages(this.mailbox, startIndex, pageSize)

    if (result.messages.length === 0) {
      return { hasMoreMessages: false }
    }

    this.totalMessages = Math.max(this.totalMessages, result.total)

    // Filter messages by date if 'since' is provided
    const filteredMessages = since ? result.messages.filter((msg) => msg.sentAt >= since.getTime()) : result.messages

    // Process and store the messages
    const savedCount = await this.storeMessages(filteredMessages)

    // Update both counters
    this.messagesProcessed += filteredMessages.length
    this.messagesSynced += savedCount

    // If we got fewer messages than requested, we've reached the end
    return { hasMoreMessages: result.messages.length === pageSize }
  }

  async syncMailbox(since?: Date, onProgress?: (status: ReturnType<typeof this.getStatus>) => void): Promise<void> {
    this.isSyncing = true
    this.shouldCancelAfterNextBatch = false
    this.messagesProcessed = 0

    try {
      // Get initial count of messages in the database for this mailbox
      const initialCount = await this.db.select({ count: count() }).from(emailMessagesTable).get()
      this.messagesSynced = initialCount?.count ?? 0

      console.log('Initial count of messages in the database:', this.messagesSynced)

      let startIndex = 1
      let hasMoreMessages = true

      while (hasMoreMessages && !this.shouldCancelAfterNextBatch) {
        // Process a batch
        const result = await this.syncPage(startIndex, this.pageSize, since)

        // Notify about progress if callback provided
        if (onProgress) {
          onProgress(this.getStatus())
        }

        if (!result.hasMoreMessages) {
          hasMoreMessages = false
          break
        }

        startIndex += this.pageSize

        // Add a small delay to let the event loop breathe
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    } catch (error) {
      console.error(`Failed to sync mailbox ${this.mailbox}:`, error)
      throw error
    } finally {
      this.isSyncing = false
      this.shouldCancelAfterNextBatch = false

      // Final progress update
      if (onProgress) {
        onProgress(this.getStatus())
      }
    }
  }

  /**
   * Store messages in the database
   * @param messages Array of messages to store
   * @returns A promise that resolves with the number of messages stored
   */
  private async storeMessages(messages: Omit<EmailMessage, 'id'>[]): Promise<number> {
    if (messages.length === 0) return 0

    // Batch insert all messages at once instead of one by one
    await this.db
      .insert(emailMessagesTable)
      .values(
        messages.map((message) => ({
          id: uuidv7(),
          ...message,
          fromAddress: null,
          parts: {} as ParsedEmail,
        }))
      )
      .onConflictDoNothing()

    // Since we can't directly get rows affected, we'll just return the number of messages
    // that were attempted to be inserted. This is an approximation.
    return messages.length
  }
}
