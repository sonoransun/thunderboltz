import { ParsedEmail } from '@/types'
import { Attachment, Message } from 'ai'
import { sql } from 'drizzle-orm'
import { customType, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const float32Array = customType<{
  data: number[]
  config: { dimensions: number }
  configRequired: true
  driverData: Buffer
}>({
  dataType(config) {
    return `F32_BLOB(${config.dimensions})`
  },
  fromDriver(value: Buffer) {
    return Array.from(new Float32Array(value.buffer))
  },
  toDriver(value: number[]) {
    return sql`vector32(${JSON.stringify(value)})`
  },
})

export const settingsTable = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`),
})

export const chatThreadsTable = sqliteTable('chat_threads', {
  id: text('id').primaryKey().notNull().unique(),
  title: text('title'),
})

export const chatMessagesTable = sqliteTable('chat_messages', {
  id: text('id').primaryKey().notNull().unique(),
  // createdat can be derived from uuid v7 id
  content: text('content').notNull(),
  attachments: text('attachments', { mode: 'json' }).$type<Attachment[]>(),
  role: text('role').notNull().$type<Message['role']>(),
  annotations: text('annotations', { mode: 'json' }).$type<Message['annotations']>(),
  parts: text('parts', { mode: 'json' }).$type<Message['parts']>(),
  chatThreadId: text('chat_thread_id')
    .notNull()
    .references(() => chatThreadsTable.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
})

export const contactsTable = sqliteTable('contacts', {
  id: text('id').primaryKey().notNull().unique(),
  name: text('name').notNull(),
  firstSeenAt: integer('first_seen_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
})

export const emailAddressesTable = sqliteTable('email_addresses', {
  address: text().primaryKey().notNull(),
  name: text('name'),
  contactId: text('contact_id').references(() => contactsTable.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  firstSeenAt: integer('first_seen_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
})

export const emailThreadsTable = sqliteTable('email_threads', {
  id: text('id').primaryKey().notNull().unique(),
  subject: text('subject').notNull(),
  rootImapId: text('root_imap_id'),
  firstMessageAt: integer('first_message_at').notNull(),
  lastMessageAt: integer('last_message_at').notNull(),
})

export const emailMessagesTable = sqliteTable('email_messages', {
  id: text('id').primaryKey().notNull().unique(),
  imapId: text('imap_id').notNull().unique(),
  htmlBody: text('html_body').notNull(),
  textBody: text('text_body').notNull(),
  parts: text('parts', { mode: 'json' }).notNull().$type<ParsedEmail>(),
  subject: text('subject'),
  sentAt: integer('sent_at').notNull(),

  fromAddress: text('from_address').references(() => emailAddressesTable.address),
  fromContactId: text('from_contact_id').references(() => contactsTable.id),

  toAddress: text('to_address').references(() => emailAddressesTable.address),
  toContactId: text('to_contact_id').references(() => contactsTable.id),

  // @todo this will become a foreign key to the email_messages table
  inReplyTo: text('in_reply_to'),

  emailThreadId: text('email_thread_id').references(() => emailThreadsTable.id, { onDelete: 'set null', onUpdate: 'cascade' }),
})

export const todosTable = sqliteTable('todos', {
  id: text('id').primaryKey().notNull().unique(),
  item: text('item').notNull(),
  imapId: text('imap_id'), // We don't use a foreign key here because the email message might not exist in the database yet
})

export const modelsTable = sqliteTable('models', {
  id: text('id').primaryKey().notNull().unique(),
  provider: text('provider', { enum: ['openai', 'fireworks', 'openai_compatible'] }).notNull(),
  model: text('model').notNull(),
  url: text('url'),
  apiKey: text('api_key'),
  isSystem: integer('is_system').default(0),
})

export const embeddingsTable = sqliteTable('embeddings', {
  id: text('id').primaryKey().notNull().unique(),
  emailMessageId: text('email_message_id')
    .unique()
    .references(() => emailMessagesTable.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  emailThreadId: text('email_thread_id')
    .unique()
    .references(() => emailThreadsTable.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  embedding: float32Array('embedding', { dimensions: 384 }),
  asText: text('as_text'),
})
