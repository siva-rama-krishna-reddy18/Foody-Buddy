// src/components/chat/ChatContainer.tsx
import { useEffect } from 'react'
import { useChatStore } from '../../stores/useChatStore'
// import SessionHeader from './SessionHeader'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import ConnectionStatus from './ConnectionStatus'

// Temporary inline SessionHeader component
function SessionHeader() {
  return (
    <div className="border-b p-4 bg-gray-50">
      <h2 className="text-lg font-semibold text-gray-800">Foody Buddy ChatBot</h2>
    </div>
  )
}

export default function ChatContainer() {
  // Temporary hardcoded values
  const sessionId = '68320f7c-5f09-4956-b211-218bc3245659'
  const customerId = '+1234567890'
  const initialTitle = 'Foody Buddy ChatBot'

  // Only destructure the properties that actually exist in your store
  const { 
    connect, 
    disconnect, 
    loadSession
  } = useChatStore()

  // Initialize connection and load session when component mounts
  useEffect(() => {
    console.log('ChatContainer: Connecting with customerId:', customerId)
    
    // Connect to socket with customer ID
    connect(customerId)

    // Cleanup on unmount
    return () => {
      console.log('ChatContainer: Cleaning up - disconnecting')
      disconnect()
    }
  }, [connect, disconnect]) // Only depend on the functions, not customerId

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto border rounded-lg">
      <ConnectionStatus />
      <SessionHeader />
      <MessageList />
      <MessageInput />
    </div>
  )
}