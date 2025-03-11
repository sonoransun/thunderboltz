import { useDrizzle } from '@/components/drizzle'
import { chatMessagesTable } from '@/db/schema'
import { HomeSidebar } from '@/home-sidebar'
import { uuidToDate } from '@/lib/utils'
import { useSettings } from '@/settings/provider'
import { Message } from '@ai-sdk/solid'
import { useParams } from '@solidjs/router'
import { LanguageModelResponseMetadata } from 'ai'
import { eq } from 'drizzle-orm'
import { createEffect, createResource, Show } from 'solid-js'
import Chat from './Chat'

export default function ChatDetailPage() {
  const params = useParams()
  const { db } = useDrizzle()
  const settingsContext = useSettings()

  const [messages] = createResource(
    () => params.chatThreadId,
    async (chatThreadId) => {
      const chatMessages = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.chat_thread_id, chatThreadId)).orderBy(chatMessagesTable.id)

      return chatMessages.map((message) => ({
        id: message.id,
        parts: message.parts,
        role: message.role,
        content: message.content,
        createdAt: uuidToDate(message.id),
      }))
    }
  )

  const onFinish = async (response: LanguageModelResponseMetadata & { readonly messages: Array<Message> }) => {
    const lastMessage = response.messages[response.messages.length - 1]
    await db.insert(chatMessagesTable).values({
      id: lastMessage.id,
      parts: lastMessage.parts || [],
      role: lastMessage.role,
      content: lastMessage.content,
      chat_thread_id: params.chatThreadId,
      model: 'gpt-4o',
      provider: 'openai',
    })
  }

  createEffect(() => {
    console.log('messages A', messages())
  })

  return (
    <>
      <HomeSidebar />
      <div class="h-full w-full">
        <Show when={messages()} fallback={<div>Error loading chat</div>}>
          <Chat apiKey={settingsContext.settings.models?.openai_api_key!} initialMessages={messages} onFinish={onFinish} />
        </Show>
      </div>
    </>
  )
}
