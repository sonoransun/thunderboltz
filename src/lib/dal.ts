import { desc, eq, notExists } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { DatabaseSingleton } from '../db/singleton'
import {
  chatMessagesTable,
  chatThreadsTable,
  emailMessagesTable,
  emailThreadsTable,
  modelsTable,
  promptsTable,
  settingsTable,
} from '../db/tables'
import { EmailThreadWithMessagesAndAddresses, type Model, type Prompt } from '../types'

/**
 * Gets the currently selected model or falls back to the system default model
 * @returns The selected model or system default model
 * @throws Error if no system model is found
 */
export const getSelectedModel = async (): Promise<Model> => {
  const db = DatabaseSingleton.instance.db
  const model = await db
    .select()
    .from(modelsTable)
    .where(
      eq(
        modelsTable.id,
        db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, 'selected_model')),
      ),
    )
    .get()

  if (model?.id) {
    return model
  }

  const systemModel = await db.select().from(modelsTable).where(eq(modelsTable.isSystem, 1)).get()

  if (!systemModel) {
    throw new Error('No system model found')
  }

  return systemModel
}

/**
 * Gets the default model for a chat thread based on the last message in the thread, falling back to the selected_model setting.
 * @param threadId The ID of the chat thread
 * @returns The default model for the chat thread
 */
export const getDefaultModelForThread = async (threadId: string, fallbackModelId?: string): Promise<Model> => {
  const db = DatabaseSingleton.instance.db

  const thread = await db.query.chatMessagesTable.findFirst({
    where: eq(chatMessagesTable.chatThreadId, threadId),
    orderBy: desc(chatMessagesTable.id),
    with: {
      model: true,
    },
  })

  if (thread?.model) {
    return thread.model
  }

  if (fallbackModelId) {
    const model = await db.query.modelsTable.findFirst({
      where: eq(modelsTable.id, fallbackModelId),
    })

    if (model) {
      return model
    }
  }

  return await getSelectedModel()
}

/**
 * Gets an existing empty chat thread or creates a new one
 * @returns The ID of the chat thread to use
 */
export const getOrCreateChatThread = async (isEncrypted: boolean = false): Promise<string> => {
  const db = DatabaseSingleton.instance.db
  // First check if any threads exist
  const threads = await db.select().from(chatThreadsTable).orderBy(desc(chatThreadsTable.id))

  if (threads.length === 0) {
    // No threads exist, create a new one
    const chatThreadId = uuidv7()
    await db.insert(chatThreadsTable).values({ id: chatThreadId, title: 'New Chat', isEncrypted: isEncrypted ? 1 : 0 })
    return chatThreadId
  }

  // Check for empty threads first
  const emptyThreads = await db
    .select({ id: chatThreadsTable.id })
    .from(chatThreadsTable)
    .where(
      notExists(db.select().from(chatMessagesTable).where(eq(chatMessagesTable.chatThreadId, chatThreadsTable.id))),
    )
    .limit(1)

  if (emptyThreads.length > 0) {
    // Use the empty thread
    return emptyThreads[0].id
  }

  // No empty threads, create a new one
  const chatThreadId = uuidv7()
  await db.insert(chatThreadsTable).values({ id: chatThreadId, title: 'New Chat', isEncrypted: isEncrypted ? 1 : 0 })
  return chatThreadId
}

export const getEmailThreadByIdWithMessages = async (
  emailThreadId: string,
): Promise<EmailThreadWithMessagesAndAddresses | null> => {
  const db = DatabaseSingleton.instance.db
  const thread = await db.select().from(emailThreadsTable).where(eq(emailThreadsTable.id, emailThreadId)).get()

  if (!thread) return null

  const messages = await db.query.emailMessagesTable.findMany({
    where: eq(emailMessagesTable.emailThreadId, emailThreadId),
    with: {
      sender: true,
      recipients: {
        with: {
          address: true,
        },
      },
    },
    orderBy: (messages, { asc }) => [asc(messages.sentAt)],
  })
  return { ...thread, messages }
}

export const getEmailThreadByMessageImapIdWithMessages = async (
  imapId: string,
): Promise<EmailThreadWithMessagesAndAddresses | null> => {
  const db = DatabaseSingleton.instance.db
  const message = await db.select().from(emailMessagesTable).where(eq(emailMessagesTable.imapId, imapId)).get()

  if (!message || !message.emailThreadId) return null

  const thread = await db.select().from(emailThreadsTable).where(eq(emailThreadsTable.id, message.emailThreadId)).get()

  if (!thread) return null

  const messages = await db.query.emailMessagesTable.findMany({
    where: eq(emailMessagesTable.emailThreadId, thread.id),
    with: {
      sender: true,
      recipients: {
        with: {
          address: true,
        },
      },
    },
    orderBy: (messages, { asc }) => [asc(messages.sentAt)],
  })

  return { ...thread, messages }
}

export const getEmailThreadByMessageIdWithMessages = async (
  emailMessageId: string,
): Promise<EmailThreadWithMessagesAndAddresses | null> => {
  const db = DatabaseSingleton.instance.db
  const message = await db.select().from(emailMessagesTable).where(eq(emailMessagesTable.id, emailMessageId)).get()

  if (!message || !message.emailThreadId) return null

  const thread = await db.select().from(emailThreadsTable).where(eq(emailThreadsTable.id, message.emailThreadId)).get()

  if (!thread) return null

  const messages = await db.query.emailMessagesTable.findMany({
    where: eq(emailMessagesTable.emailThreadId, thread.id),
    with: {
      sender: true,
      recipients: {
        with: {
          address: true,
        },
      },
    },
    orderBy: (messages, { asc }) => [asc(messages.sentAt)],
  })

  return { ...thread, messages }
}

/**
 * Get a setting value from the settings table
 * @param key The setting key to retrieve
 * @returns The setting value or null if not found
 */
export const getSetting = async <T = string>(key: string, defaultValue: T | null = null): Promise<T | null> => {
  const db = DatabaseSingleton.instance.db
  const setting = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).get()
  return (setting?.value as T) || defaultValue
}

/**
 * Get a boolean setting value from the settings table
 * @param key The setting key to retrieve
 * @param defaultValue The default boolean value if setting doesn't exist
 * @returns The boolean setting value
 */
export const getBooleanSetting = async (key: string, defaultValue: boolean = false): Promise<boolean> => {
  const setting = await getSetting(key, defaultValue.toString())
  return setting === 'true'
}

/**
 * Update or create a setting in the settings table
 * @param key The setting key to update
 * @param value The new value for the setting
 */
export const updateSetting = async (key: string, value: string | null): Promise<void> => {
  const db = DatabaseSingleton.instance.db
  await db.insert(settingsTable).values({ key, value }).onConflictDoUpdate({
    target: settingsTable.key,
    set: { value },
  })
}

/**
 * Gets all available (enabled) models from the database
 * @returns Array of enabled models
 */
export const getAvailableModels = async (): Promise<Model[]> => {
  const db = DatabaseSingleton.instance.db
  return await db.select().from(modelsTable).where(eq(modelsTable.enabled, 1))
}

/**
 * Returns the automation prompt that triggered a chat thread, if any.
 *
 * @param threadId - The ID of the chat thread
 * @returns The automation prompt's title and prompt text, or null if the thread was not triggered by an automation.
 */
export const getTriggerPromptForThread = async (threadId: string): Promise<Prompt | null> => {
  const db = DatabaseSingleton.instance.db

  // Fetch the associated prompt in a single query via join
  const result = await db
    .select({ prompt: promptsTable })
    .from(chatThreadsTable)
    .leftJoin(promptsTable, eq(chatThreadsTable.triggeredBy, promptsTable.id))
    .where(eq(chatThreadsTable.id, threadId))
    .get()

  return result?.prompt ?? null
}
