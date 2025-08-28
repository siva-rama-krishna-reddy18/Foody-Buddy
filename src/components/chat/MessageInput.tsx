// src/components/chat/MessageInput.tsx
import { useState } from 'react';
import { useChatStore } from '../../stores/useChatStore';

interface Props {
  customerId: string;
}

export default function MessageInput({ customerId }: Props) {
  const [text, setText] = useState('');
  const { sendMessage, connected } = useChatStore();

  const handleSend = () => {
    if (text.trim() && connected) {
      sendMessage(text, customerId);
      setText('');
    }
  };

  return (
    <div className="p-3 border-t flex gap-2 items-center bg-white">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder={!connected ? 'Connecting...' : 'Type your message...'}
        disabled={!connected}
        className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
      />
      <button
        onClick={handleSend}
        disabled={!connected || !text.trim()}
        className={`rounded-full w-10 h-10 flex items-center justify-center ${
          !connected || !text.trim()
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-800 text-white'
        }`}
      >
        ➤
      </button>
    </div>
  );
}