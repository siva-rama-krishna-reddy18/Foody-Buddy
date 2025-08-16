import { useState } from 'react';
import { useChatStore } from '../../stores/useChatStore';

export default function MessageInput() {
  const [text, setText] = useState('');
  const sendMessage = useChatStore((state) => state.sendMessage);

  const handleSend = () => {
    if (text.trim()) {
      sendMessage(text);
      setText('');
    }
  };

  return (
    <div className="p-4 border-t flex gap-2">
      <input
        className="flex-1 border rounded px-3 py-2"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your message..."
      />
      <button
        onClick={handleSend}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Send
      </button>
    </div>
  );
}