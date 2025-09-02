// src/components/chat/ChatContainer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Send, ShoppingBag, MessageCircle, Menu, Star, Package, Clock } from 'lucide-react';
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

  // Initialize chat and load cart when component mounts
  useEffect(() => {
    if (customerId) {
      initializeChat(customerId);
      loadCart(customerId);
    }
  }, [customerId, initializeChat, loadCart]);

  // Auto-scroll to bottom when new messages arrive
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

  // Navigation button handlers
  const handleViewMenu = async () => {
    await sendMessage("Show me the menu");
  };

  const handleTrackOrders = async () => {
    await sendMessage("Track my orders");
  };

  const handleTodaysSpecials = async () => {
    await sendMessage("What are today's specials?");
  };

  const handleShowCart = async () => {
    setIsCartOpen(true); // Open cart drawer directly
  };

  return (
    <div className="flex flex-col h-screen bg-blue-50">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-black font-semibold text-lg">FoodyBuddy Assistant</h1>
              <p className="text-black/70 text-sm">Your personal food ordering assistant</p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleViewMenu}
              className="flex flex-col items-center space-y-1 bg-gray-200 hover:bg-white/30 backdrop-blur-sm rounded-xl p-3 text-black font-medium transition-all duration-200 hover:scale-105 border border-white/20"
            >
              <Menu className="w-4 h-4" />
              <span className="text-xs">View Menu</span>
            </button>
            
            <button
              onClick={handleTrackOrders}
              className="flex flex-col items-center space-y-1 bg-gray-200 hover:bg-white/30 backdrop-blur-sm rounded-xl p-3 text-black font-medium transition-all duration-200 hover:scale-105 border border-white/20"
            >
              <Package className="w-4 h-4" />
              <span className="text-xs">Track Orders</span>
            </button>
            
            <button
              onClick={handleTodaysSpecials}
              className="flex flex-col items-center space-y-1 bg-gray-200 hover:bg-white/30 backdrop-blur-sm rounded-xl p-3 text-black font-medium transition-all duration-200 hover:scale-105 border border-white/20"
            >
              <Star className="w-4 h-4" />
              <span className="text-xs">Today's Specials</span>
            </button>
            
            <button
              onClick={handleShowCart}
              className="flex flex-col items-center space-y-1 bg-gray-200 hover:bg-white/30 backdrop-blur-sm rounded-xl p-3 text-black font-medium transition-all duration-200 hover:scale-105 border border-white/20"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="text-xs">Show my cart</span>
            </button>
          </div>
          
          {/* Cart Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative bg-gray-200 hover:bg-white/30 backdrop-blur-sm text-black px-4 py-2 rounded-full flex items-center space-x-2 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="text-black font-medium">Your Order</span>
            {itemCount > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-black text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {itemCount}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="max-w-2xl mx-auto">
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
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-gray-100 border-0 rounded-full px-4 py-3 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-green-300 text-white p-3 rounded-full transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          
          <div className="text-center text-xs text-gray-500 mt-2">
            Items in your cart
          </div>
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