// src/components/chat/MessageInput.tsx
import { useState, KeyboardEvent } from 'react'
import { useChatStore } from '../../stores/useChatStore'

export default function MessageInput() {
  const [message, setMessage] = useState('')
  const { sendMessage, connected } = useChatStore()
  
  // Use the same hardcoded customerId as in ChatContainer
  const customerId = '+1234567890'

  const handleSend = () => {
    if (message.trim() && connected) {
      sendMessage(message, customerId)
      setMessage('')
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t p-4 bg-white">
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={!connected ? "Connecting..." : "Type your message..."}
          disabled={!connected}
          className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            !connected 
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
              : 'bg-white'
          }`}
        />
        <button
          onClick={handleSend}
          disabled={!connected || !message.trim()}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            !connected || !message.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          Send
        </button>
      </div>
    </div>
  )
}