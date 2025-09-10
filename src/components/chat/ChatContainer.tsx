// src/components/chat/ChatContainer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Send, ShoppingBag, MessageCircle, Minimize2, MessageSquare } from 'lucide-react';
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
  const [isMinimized, setIsMinimized] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
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

  const quickActions = ['View Menu', 'Track Orders', "Today's Specials", 'Show my cart'];

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${
        isMinimized ? 'h-14 w-80' : 'h-[calc(100vh-2rem)] w-full max-w-md'
      }`}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">FoodBot Assistant</h3>
              <p className="text-xs opacity-80">Your personal food ordering assistant</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 relative">
            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 hover:bg-white/20 rounded-full"
            >
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {itemCount}
                </span>
              )}
            </button>

            {/* Quick Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-white/20 rounded-full"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-white shadow-md rounded-lg overflow-hidden z-50 text-gray-700 text-sm">
                  {quickActions.map((action) => (
                    <button
                      key={action}
                      onClick={() => {
                        sendQuickAction(action);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 hover:bg-gray-100 text-left"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Minimize Button */}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-white/20 rounded-full"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id || index}
                  message={message}
                  onAddToCart={addProductToCart}
                  onSuggestionClick={sendQuickAction}
                />
              ))}

              {isLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center">🤖</div>
                  <div className="typing-indicator flex gap-1 bg-gray-200 px-3 py-2 rounded-full">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-300"></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t bg-white flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-2 transition"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        )}
      </div>

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} customerId={customerId} />
    </div>
  );
}