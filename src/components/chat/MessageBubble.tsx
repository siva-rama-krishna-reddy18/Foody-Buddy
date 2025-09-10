// src/components/chat/MessageBubble.tsx
import React from 'react';
import type { ChatMessage, Product } from '../../types';

interface Props {
  message: ChatMessage;
  onAddToCart?: (product: Product) => void;
  onSuggestionClick?: (suggestion: string) => void;
}

export default function MessageBubble({ message, onAddToCart, onSuggestionClick }: Props) {
  const isMe = message.sender === 'me';

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-2 max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0
            ${isMe ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'}`}
        >
          {isMe ? '👤' : '🤖'}
        </div>

        {/* Message bubble */}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed
            ${isMe ? 'bg-green-500 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'}`}
        >
          {message.text}

          {/* Quick Actions only on first welcome message */}
          {message.type === 'welcome' && (
            <div className="flex gap-2 flex-wrap mt-2">
              {['View Menu', 'Track Orders', "Today's Specials", 'Show my cart'].map((action) => (
                <button
                  key={action}
                  onClick={() => onSuggestionClick?.(action)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-full text-xs transition"
                >
                  {action}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}