import { relations } from 'drizzle-orm'
import { chatMessagesTable, chatThreadsTable, contactsTable, emailAddressesTable, emailMessagesTable, emailThreadsTable, embeddingsTable, modelsTable, settingsTable, todosTable } from './schema'

export const chatThreadsRelations = relations(chatThreadsTable, ({ many }) => ({
  messages: many(chatMessagesTable),
}))

export const chatMessagesRelations = relations(chatMessagesTable, ({ one }) => ({
  thread: one(chatThreadsTable, {
    fields: [chatMessagesTable.chatThreadId],
    references: [chatThreadsTable.id],
  }),
}))

export const embeddingsRelations = relations(embeddingsTable, ({ one }) => ({
  emailMessage: one(emailMessagesTable, {
    fields: [embeddingsTable.emailMessageId],
    references: [emailMessagesTable.id],
  }),
  emailThread: one(emailThreadsTable, {
    fields: [embeddingsTable.emailThreadId],
    references: [emailThreadsTable.id],
  }),
}))

export const emailMessagesRelations = relations(emailMessagesTable, ({ one }) => ({
  embedding: one(embeddingsTable, {
    fields: [emailMessagesTable.id],
    references: [embeddingsTable.emailMessageId],
  }),
  thread: one(emailThreadsTable, {
    fields: [emailMessagesTable.emailThreadId],
    references: [emailThreadsTable.id],
  }),
  fromContact: one(contactsTable, {
    fields: [emailMessagesTable.fromContactId],
    references: [contactsTable.id],
  }),
  toContact: one(contactsTable, {
    fields: [emailMessagesTable.toContactId],
    references: [contactsTable.id],
  }),
  fromEmailAddress: one(emailAddressesTable, {
    fields: [emailMessagesTable.fromAddress],
    references: [emailAddressesTable.address],
  }),
  toEmailAddress: one(emailAddressesTable, {
    fields: [emailMessagesTable.toAddress],
    references: [emailAddressesTable.address],
  }),
}))

export const emailThreadsRelations = relations(emailThreadsTable, ({ many, one }) => ({
  messages: many(emailMessagesTable),
  embedding: one(embeddingsTable, {
    fields: [emailThreadsTable.id],
    references: [embeddingsTable.emailThreadId],
  }),
  todos: many(todosTable),
}))

export const contactsRelations = relations(contactsTable, ({ many }) => ({
  emailAddresses: many(emailAddressesTable),
  sentEmails: many(emailMessagesTable, { relationName: 'fromContact' }),
  receivedEmails: many(emailMessagesTable, { relationName: 'toContact' }),
}))

export const emailAddressesRelations = relations(emailAddressesTable, ({ one, many }) => ({
  contact: one(contactsTable, {
    fields: [emailAddressesTable.contactId],
    references: [contactsTable.id],
  }),
  sentEmails: many(emailMessagesTable, { relationName: 'fromEmailAddress' }),
  receivedEmails: many(emailMessagesTable, { relationName: 'toEmailAddress' }),
}))

export const todosRelations = relations(todosTable, ({ many }) => ({
  emailThreads: many(emailThreadsTable),
}))

export const settingsRelations = relations(settingsTable, ({}) => ({}))

export const modelsRelations = relations(modelsTable, ({}) => ({}))
