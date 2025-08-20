// src/components/chat/MessageBubble.tsx
import type { ChatMessage } from '@/types/chat'

export default function MessageBubble({ message }: { message: ChatMessage }) {
  // If AI sends structured response (menu, deals, etc.)
  if (message.text && message.text.includes('🍕')) {
    return (
      <div className="p-2 bg-green-100 rounded mb-1 max-w-md">
        <pre className="whitespace-pre-wrap">{message.text}</pre>
      </div>
    )
  }

  return (
    <div
      className={`p-2 rounded mb-1 max-w-md ${
        message.sender === 'me' ? 'bg-blue-100 self-end' : 'bg-gray-100 self-start'
      }`}
    >
      {message.text}
    </div>
  )
}