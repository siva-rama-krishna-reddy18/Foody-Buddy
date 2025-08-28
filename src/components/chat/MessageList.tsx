// src/components/chat/MessageList.tsx
import { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/useChatStore';
import QuickActions from './QuickActions';

export default function MessageList() {
  const { messages } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-2 max-w-[80%] ${msg.sender === 'me' ? 'self-end flex-row-reverse' : 'self-start'}`}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0
              ${msg.sender === 'me' ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'}`}
          >
            {msg.sender === 'me' ? '👤' : '🤖'}
          </div>
          <div
            className={`p-3 rounded-2xl text-sm leading-relaxed ${
              msg.sender === 'me'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {msg.text}
            {msg.type === 'welcome' && (
              <div className="mt-2">
                <QuickActions />
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </>
  );
}
