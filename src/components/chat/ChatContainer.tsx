// src/components/chat/ChatContainer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Send, ShoppingBag, MessageCircle, Menu, Star, Package } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { useCartStore } from '../../stores/useCartStore';
import MessageBubble from './MessageBubble';
import CartDrawer from '../cart/CartDrawer';

interface Props {
  customerId: string;
}

export default function ChatContainer({ customerId }: Props) {
  const [inputText, setInputText] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    sendMessage,
    sendQuickAction,
    addProductToCart,
    initializeChat
  } = useChatStore();

  const { itemCount, loadCart } = useCartStore();

  useEffect(() => {
    if (customerId) {
      initializeChat(customerId);
      loadCart(customerId);
    }
  }, [customerId, initializeChat, loadCart]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const messageText = inputText.trim();
    setInputText('');
    await sendMessage(messageText);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    await sendQuickAction(suggestion);
  };

  const handleAddToCart = async (product: any) => {
    await addProductToCart(product);
  };

  return (
    <div className="flex flex-col h-screen bg-blue-50">
      {/* Header */}
      <div className="bg-white border-b px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-black" />
            </div>
            <div>
              <h1 className="text-black font-semibold text-sm">FoodyBuddy Assistant</h1>
              <p className="text-black/70 text-xs">Your food ordering assistant</p>
            </div>
          </div>

          {/* Cart Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative bg-gray-200 hover:bg-gray-300 text-black px-3 py-2 rounded-full flex items-center space-x-1 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            {itemCount > 0 && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {itemCount}
              </div>
            )}
          </button>
        </div>

        {/* Navigation Buttons (always scrollable row for mobile-first) */}
        <div className="flex overflow-x-auto mt-3 space-x-2 pb-1">
          <button
            onClick={() => sendMessage("Show me the menu")}
            className="flex flex-col items-center bg-gray-100 rounded-lg px-3 py-2 text-xs font-medium text-black hover:bg-gray-200 min-w-[70px]"
          >
            <Menu className="w-4 h-4 mb-1" />
            Menu
          </button>
          <button
            onClick={() => sendMessage("Track my orders")}
            className="flex flex-col items-center bg-gray-100 rounded-lg px-3 py-2 text-xs font-medium text-black hover:bg-gray-200 min-w-[70px]"
          >
            <Package className="w-4 h-4 mb-1" />
            Orders
          </button>
          <button
            onClick={() => sendMessage("What are today's specials?")}
            className="flex flex-col items-center bg-gray-100 rounded-lg px-3 py-2 text-xs font-medium text-black hover:bg-gray-200 min-w-[70px]"
          >
            <Star className="w-4 h-4 mb-1" />
            Specials
          </button>
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex flex-col items-center bg-gray-100 rounded-lg px-3 py-2 text-xs font-medium text-black hover:bg-gray-200 min-w-[70px]"
          >
            <ShoppingBag className="w-4 h-4 mb-1" />
            Cart
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        <div className="max-w-lg mx-auto">
          {messages.map((message, index) => (
            <MessageBubble
              key={`${message.id || index}`}
              message={message}
              onAddToCart={handleAddToCart}
              onSuggestionClick={handleSuggestionClick}
            />
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl px-3 py-2 shadow-sm border text-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t px-3 py-3">
        <div className="max-w-lg mx-auto">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-gray-100 border-0 rounded-full px-3 py-2 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white p-2 rounded-full transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        customerId={customerId}
      />
    </div>
  );
}