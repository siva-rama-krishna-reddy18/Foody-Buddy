// src/components/chat/MessageBubble.tsx
import React from 'react';
import { ShoppingCart, Star } from 'lucide-react';
import type { ChatMessage, Product } from '../../types/index';

interface Props {
  message: ChatMessage;
  onAddToCart?: (product: Product) => void;
  onSuggestionClick?: (suggestion: string) => void;
}

export default function MessageBubble({ message, onAddToCart, onSuggestionClick }: Props) {
  const { text, sender, products, suggestions, type } = message;
  const isMe = sender === 'me';

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 sm:mb-4`}>
      <div className="max-w-[85%] sm:max-w-[80%]">
        {/* Main message bubble */}
        <div
          className={`px-3 py-2 sm:px-4 sm:py-3 rounded-2xl shadow-sm text-sm sm:text-base ${
            isMe 
              ? 'bg-blue-500 text-white rounded-br-md' 
              : 'bg-white text-gray-800 rounded-bl-md border'
          }`}
        >
          <p className="leading-relaxed">{text}</p>
        </div>

        {/* Products */}
        {products && products.length > 0 && (
          <div className="mt-2 sm:mt-3 space-y-2">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-xl border p-3 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <h4 className="font-medium text-gray-900 text-sm sm:text-base mb-1">
                      {product.name}
                    </h4>
                    {product.description && (
                      <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-base sm:text-lg font-semibold text-blue-600">
                        ${product.price}
                      </span>
                      <div className="flex items-center text-xs text-gray-500">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
                        4.5
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onAddToCart?.(product)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg flex items-center space-x-1 text-xs sm:text-sm font-medium"
                  >
                    <ShoppingCart className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {(suggestions && suggestions.length > 0) || type === 'welcome' ? (
          <div className="mt-2 sm:mt-3 flex flex-wrap gap-2">
            {(suggestions || ['View Menu', 'Track Orders', "Today's Specials"]).map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 sm:px-3 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors border"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {/* Timestamp */}
        {message.timestamp && (
          <p className={`text-[10px] sm:text-xs mt-1 ${
            isMe ? 'text-right text-gray-500' : 'text-gray-500'
          }`}>
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        )}
      </div>
    </div>
  );
}