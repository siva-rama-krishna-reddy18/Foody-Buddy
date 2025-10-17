import { useEffect, useRef } from 'react'
import { useChatStore } from '../../stores/useChatStore'

export default function MessageList() {
  const { messages, sendMessage, customerId } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
      {messages.length === 0 ? (
        <div className="text-center text-gray-500 mt-8">
          <p>No messages yet...</p>
          <p className="text-xs mt-2">Start typing to see messages appear here</p>
        </div>
      ) : (
        messages.map((msg, index) => (
          <div 
            key={index} 
            className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              msg.sender === 'me' 
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-800 border shadow-sm'
            }`}>
              <div className="text-xs opacity-75 mb-1">
                {msg.sender === 'me' ? 'You' : 'Bot'}
              </div>
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {/* Render quick actions if present */}
              {msg.quickActions && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {msg.quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (customerId) {
                          sendMessage(action.label, customerId)
                        }
                      }}
                      className="px-3 py-1 text-sm rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}