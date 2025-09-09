// src/components/chat/MessageInput.tsx
import { useState, KeyboardEvent } from 'react';
import { useChatStore } from '../../stores/useChatStore';

interface Props {
  customerId: string;
}

export default function MessageInput({ customerId }: Props) {
  const [message, setMessage] = useState('');
  const { sendMessage } = useChatStore();

  const handleSend = () => {
    if (message.trim()) {
      sendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t p-4 bg-white">
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim()}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            !message.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          Send
        </button>
      </div>
    </div>
  );
}