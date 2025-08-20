// src/components/chat/ChatContainer.tsx
import SessionHeader from './SessionHeader'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import ConnectionStatus from './ConnectionStatus'

export default function ChatContainer() {
  // Temporary props for now – in Week 2 we’ll wire these from store/session state
  const sessionId = '68320f7c-5f09-4956-b211-218bc3245659'
  const customerId = '+1234567890'

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto border rounded-lg">
      <ConnectionStatus />
      <SessionHeader
        sessionId={sessionId}
        customerId={customerId}
        initialTitle="My Food Chat"
      />
      <MessageList />
      <MessageInput />
    </div>
  )
}