import { useState } from 'react'
import { useChatStore } from '../../stores/useChatStore'

export default function MessageInput() {
  const [text, setText] = useState('')
  const sendMessage = useChatStore((state) => state.sendMessage)

  const handleSend = () => {
    if (text.trim()) {
      sendMessage(text)
      setText('')
    }
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 border rounded-lg px-3 py-2 focus:outline-none"
      />
      <button
        onClick={handleSend}
        className="bg-blue-500 text-white px-4 py-2 rounded-lg"
      >
        Send
      </button>
    </div>
  )
}