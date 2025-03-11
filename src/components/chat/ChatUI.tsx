import type { UseChatHelpers } from '@ai-sdk/solid'
import { createEffect, For, Match, Switch } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { AgentToolResponse } from './AgentChatResponse'

interface ChatUIProps {
  chatHelpers: () => UseChatHelpers
}

export default function ChatUI({ chatHelpers }: ChatUIProps) {
  createEffect(() => {
    console.log('messages', unwrap(chatHelpers().messages()))
  })

  return (
    <div class="flex flex-col h-full bg-gray-50 overflow-hidden">
      <div class="flex-1 p-4 overflow-y-auto space-y-4">
        <For each={chatHelpers().messages()}>
          {(message, i) => (
            <Switch fallback={null}>
              <Match when={message.role === 'assistant'}>
                <div class="p-4 space-y-2 rounded-tl-lg rounded-tr-lg rounded-br-lg max-w-3/4 bg-white border border-gray-200 mr-auto">
                  {message.content && <div class="text-gray-700 leading-relaxed">{message.content}</div>}
                  <For each={message.parts?.filter((part) => part.type === 'tool-invocation')}>{(part) => <AgentToolResponse part={part} />}</For>
                </div>
              </Match>
              <Match when={message.role === 'user'}>
                <div class="p-4 rounded-tl-lg rounded-tr-lg rounded-bl-lg max-w-3/4 bg-indigo-100 text-gray-800 ml-auto">
                  <div class="space-y-2">
                    <div class="text-gray-700 leading-relaxed">{message.content}</div>
                  </div>
                </div>
              </Match>
            </Switch>
          )}
        </For>
      </div>

      <div class="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={chatHelpers().handleSubmit} class="flex gap-2">
          <input
            value={chatHelpers().input()}
            onInput={chatHelpers().handleInputChange}
            placeholder="Say something..."
            class="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
