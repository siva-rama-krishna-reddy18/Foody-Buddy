import { useChatStore } from '../../stores/useChatStore'
import MessageBubble from './MessageBubble'

export default function MessageList() {
  const messages = useChatStore((state) => state.messages)

  return (
    <div className="p-4 space-y-2">
      {messages.map((msg, i) => (
        <MessageBubble key={i} text={msg.text} sender={msg.sender} />
      ))}
    </div>
  )
}