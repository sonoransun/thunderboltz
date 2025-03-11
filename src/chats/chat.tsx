import ChatUI from '@/components/chat/ChatUI'
import { aiFetchStreamingResponse } from '@/lib/ai'
import { useChat } from '@ai-sdk/solid'
import { LanguageModelResponseMetadata, Message } from 'ai'
import { createMemo, Show } from 'solid-js'

interface ChatProps {
  apiKey: string
  initialMessages: () => any[]
  maxSteps?: number
  onFinish?: (response: LanguageModelResponseMetadata & { readonly messages: Array<Message> }) => Promise<void> | void
}

export default function Chat({ apiKey, initialMessages, maxSteps = 5, onFinish }: ChatProps) {
  const chatHelpers = createMemo(() => {
    return useChat({
      initialMessages: initialMessages(),
      fetch: (_requestInfoOrUrl, init) => {
        if (!apiKey) {
          throw new Error('No API key found')
        }

        if (!init) {
          throw new Error('No init found')
        }

        return aiFetchStreamingResponse({
          apiKey,
          init,
          onFinish,
        })
      },
      maxSteps,
    })
  })

  return (
    <Show when={initialMessages()} fallback={<div>Loading chat...</div>}>
      <ChatUI chatHelpers={chatHelpers} />
    </Show>
  )
}
