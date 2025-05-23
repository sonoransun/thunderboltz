import { Model } from '@/types'
import type { UseChatHelpers } from '@ai-sdk/react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { AgentToolResponse } from './agent-tool-response'
import { Reasoning } from './reasoning'

interface ChatUIProps {
  chatHelpers: UseChatHelpers
  models: Model[]
  selectedModel: string | null
  onModelChange: (model: string | null) => void
}

export default function ChatUI({ chatHelpers, models, selectedModel, onModelChange }: ChatUIProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [hasMessages, setHasMessages] = useState(chatHelpers.messages.length > 0)
  const formRef = useRef<HTMLFormElement>(null)
  const containerWidth = 696 // 728px container - 16px padding on each side

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
    setHasMessages(chatHelpers.messages.length > 0)
  }, [chatHelpers.messages])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    chatHelpers.handleSubmit(e)
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden max-w-[728px] mx-auto">
      <AnimatePresence>
        {hasMessages && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 p-4 overflow-y-auto space-y-4">
            {chatHelpers.messages.map((message, i) => {
              if (message.role === 'assistant') {
                return (
                  <div key={i} className="space-y-2 p-4 rounded-md bg-secondary mr-auto">
                    {message.parts
                      .filter((part) => part.type === 'tool-invocation')
                      .map((part, j) => (
                        <AgentToolResponse key={j} part={part} />
                      ))}
                    {message.parts
                      .filter((part) => part.type === 'reasoning')
                      .map((part, j) => (
                        <Reasoning key={j} text={part.text} />
                      ))}
                    {message.parts
                      .filter((part) => part.type === 'text')
                      .map((part, j) => (
                        <div key={j} className="text-secondary-foreground leading-relaxed">
                          {part.text}
                        </div>
                      ))}
                  </div>
                )
              } else if (message.role === 'user') {
                return message.parts
                  .filter((part) => part.type === 'text')
                  .map((part, j) => (
                    <div key={j} className="p-4 rounded-md max-w-3/4 bg-primary text-primary-foreground ml-auto">
                      <div className="space-y-2">
                        <div className="text-primary-foreground leading-relaxed">{part.text}</div>
                      </div>
                    </div>
                  ))
              }
              return null
            })}
            <div ref={messagesEndRef} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="p-4"
        style={{
          display: 'flex',
          flex: !hasMessages ? '1' : 'none',
          alignItems: !hasMessages ? 'center' : 'flex-end',
          justifyContent: !hasMessages ? 'center' : 'flex-start',
        }}
        initial={false}
        layout
        transition={{
          type: 'tween',
          ease: [0.2, 0.9, 0.1, 1],
          duration: 0.25,
        }}
      >
        <motion.form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 bg-secondary p-4 rounded-md"
          style={{ width: containerWidth }}
          layout
          transition={{
            type: 'tween',
            ease: [0.2, 0.9, 0.1, 1],
            duration: 0.25,
          }}
        >
          <Input variant="ghost" autoFocus value={chatHelpers.input} onChange={chatHelpers.handleInputChange} placeholder="Say something..." className="flex-1 px-4 py-2" />
          <div className="flex gap-2 justify-end items-center w-full">
            <Select value={selectedModel || ''} onValueChange={onModelChange}>
              <SelectTrigger className="rounded-full" size="sm" variant="outline">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <p className="text-left">{model.name}</p>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="default" className="h-6 w-6 rounded-full flex items-center justify-center">
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </motion.form>
      </motion.div>
    </div>
  )
}
