// src/components/chat/ChatContainer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Send, ShoppingBag, MessageCircle, Minimize2 } from 'lucide-react';
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

  if (!customerId) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

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

  const handleShowCart = async () => {
    await sendMessage('show my cart');
  };
  // In ChatContainer.tsx, add these handlers:
const handleUpdateCartQuantity = async (productId: string, action: 'increase' | 'decrease') => {
  if (action === 'increase') {
    await sendMessage(`increase quantity of ${productId}`);
  } else {
    await sendMessage(`decrease quantity of ${productId}`);
  }
};

const handleRemoveFromCart = async (productId: string) => {
  await sendMessage(`remove ${productId} from cart`);
};


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl border border-gray-200 transition-all duration-300 flex flex-col ${
        isMinimized ? 'h-14 w-80' : 'h-[calc(100vh-2rem)] w-80'
      }`}>
        
        <div className="bg-blue-500 text-white p-3 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">FoodyBuddy</h3>
              <p className="text-xs opacity-90">AI Food Assistant</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={handleShowCart}
              className="relative p-1 hover:bg-blue-600 rounded"
            >
              <ShoppingBag className="w-4 h-4" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {itemCount}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-blue-600 rounded"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-3 bg-gray-50 space-y-2">
              {messages.map((message, index) => (
                <div key={`${message.id || index}`} className="text-sm">
                  <MessageBubble
  message={message}
  onAddToCart={handleAddToCart}
  onSuggestionClick={handleSuggestionClick}
  onUpdateCartQuantity={handleUpdateCartQuantity}
  onRemoveFromCart={handleRemoveFromCart}
/>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-bl-md px-3 py-2 shadow-sm border">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-gray-200 rounded-b-2xl bg-white flex-shrink-0">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-full p-2 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}