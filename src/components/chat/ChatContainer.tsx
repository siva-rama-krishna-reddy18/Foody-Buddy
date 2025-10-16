import { useState, useEffect, useRef } from 'react';
import { Send, Menu, MapPin, Tag, ShoppingCart, User, Link, Share2, MoreHorizontal, ChevronDown, Plus, Minus, Trash2 } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { useCartStore } from '../../stores/useCartStore';
import MessageBubble from './MessageBubble';

interface Props {
  customerId: string;
}

export default function ChatContainer({ customerId }: Props) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Chat store
  const { messages, isLoading, sendMessage, aiThinking, initializeChat } = useChatStore();
  
  // ✅ Cart store - with all properties including discount and coupon
  const { items: cartItems, total: cartTotal, subtotal: cartSubtotal, discount: cartDiscount, coupon: cartCoupon, specialInstructions, itemCount } = useCartStore();
  
  const [showWelcome, setShowWelcome] = useState(true);

  // 🔍 Debug: Log cart state whenever it changes
  useEffect(() => {
    console.log('🛒 SIDEBAR Cart State:', {
       cartItems: cartItems.length,
      cartTotal,
      cartSubtotal,
      cartDiscount,
      cartCoupon,
      itemCount
      
    });
  }, [cartItems, cartTotal, cartSubtotal, cartDiscount, cartCoupon, itemCount]);

  const suggestions = [
    { icon: Menu, title: 'View Menu', subtitle: 'Explore flavors you\'ll love.' },
    { icon: MapPin, title: 'Track Orders', subtitle: 'Your order\'s on its way!' },
    { icon: Tag, title: 'Today\'s Specials', subtitle: 'Don\'t miss today\'s top flavors.' }
  ];

  useEffect(() => {
    if (customerId) {
      initializeChat(customerId);
    }
  }, [customerId, initializeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      setShowWelcome(false);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputValue.trim() && !isLoading) {
      await sendMessage(inputValue, customerId);
      setInputValue('');
      setShowWelcome(false);
    }
  };

  const handleSuggestionClick = async (title: string) => {
    await sendMessage(title, customerId);
    setShowWelcome(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ✅ Cart action handlers for sidebar - simplified messages
  const handleQuantityUpdate = (productId: string, currentQuantity: number, action: 'increase' | 'decrease') => {
    const item = cartItems.find(i => i.productId === productId);
    if (!item) return;
    
    console.log('🔄 Quantity update clicked:', { productId, currentQuantity, action, itemName: item.name });
    
    if (action === 'decrease') {
      // Just say "remove one [item]" - backend will handle deletion if qty=1
      console.log('➖ Sending: remove one', item.name);
      sendMessage(`remove one ${item.name}`, customerId);
    } else {
      // Just say "add [item] to cart" - backend will increase quantity
      console.log('➕ Sending: add', item.name, 'to cart');
      sendMessage(`add ${item.name} to cart`, customerId);
    }
  };

  const handleRemoveItem = (productId: string) => {
    const item = cartItems.find(i => i.productId === productId);
    if (item) {
      console.log('🗑️ Remove button clicked - sending: remove all', item.name);
      sendMessage(`remove all ${item.name} from cart`, customerId);
    }
  };

  const handleCheckout = () => {

    const instructionsToSend: { [key: string]: string } = {};
  
  cartItems.forEach(item => {
    const instruction = specialInstructions?.[item.productId];
    if (instruction && instruction.trim()) {
      instructionsToSend[item.productId] = instruction;
    }
  });
  // ✅ Include coupon data if present
  const checkoutData = {
    action: 'Proceed to pay',
    specialInstructions: instructionsToSend,
    coupon: cartCoupon // ✅ Pass the coupon from cart store
  };
  
  sendMessage(JSON.stringify(checkoutData), customerId);
};

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
       {/* Header */}
<div className="bg-white border-b px-6 py-4">
  <div className="flex items-center justify-between max-w-7xl mx-auto">
    {/* Left: Logo and Title */}
    <div className="flex items-center space-x-3">
      <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
        <span className="text-white font-bold text-xl">FB</span>
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Foody Buddy</h1>
      </div>
    </div>

    {/* Center: Description */}
    <div className="flex-1 flex justify-center">
      <p className="text-sm text-gray-600">Your personal food ordering assistant</p>
    </div>

    {/* Right: Actions */}
    <div className="flex items-center space-x-2">
      {/* Quick Actions Menu */}
      <div className="relative group">
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <MoreHorizontal className="w-5 h-5 text-gray-600" />
        </button>
        
        {/* Dropdown Menu - shows on hover */}
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <button 
            onClick={() => sendMessage('View Menu', customerId)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
          >
            <Menu className="w-4 h-4" />
            <span>View Menu</span>
          </button>
          <button 
            onClick={() => sendMessage('Track Orders', customerId)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
          >
            <MapPin className="w-4 h-4" />
            <span>Track Orders</span>
          </button>
          <button 
            onClick={() => sendMessage("Today's Specials", customerId)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
          >
            <Tag className="w-4 h-4" />
            <span>Today's Specials</span>
          </button>
          <div className="border-t border-gray-200 my-1"></div>
          <button 
            onClick={() => {
              if (confirm('Clear all messages?')) {
                // Add clear messages function
              }
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Link/Copy Chat URL */}
      <button 
        onClick={() => {
          navigator.clipboard.writeText(window.location.href);
          // Show a toast notification
          alert('Chat link copied!');
        }}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        title="Copy chat link"
      >
        <Link className="w-5 h-5 text-gray-600" />
      </button>

      {/* Share Button */}
      <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2">
        <Share2 className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">Share</span>
      </button>
    </div>
  </div>
</div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-4xl mx-auto px-8 py-12">
            {showWelcome && messages.length === 0 ? (
              /* Welcome Screen */
              <div className="flex flex-col items-center justify-center space-y-8">
                <div className="w-32 h-32 bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl flex items-center justify-center shadow-2xl">
                  <div className="text-center">
                    <div className="text-white font-bold text-4xl">Foody</div>
                    <div className="text-white font-bold text-2xl">Buddy</div>
                  </div>
                </div>
                
                <h2 className="text-4xl font-bold text-gray-900">Let's start a smart conversation</h2>
                
                <div className="grid grid-cols-3 gap-4 w-full max-w-3xl mt-8">
                  {suggestions.map((suggestion, index) => {
                    const IconComponent = suggestion.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion.title)}
                        className="p-6 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all duration-200 text-left border border-gray-200 hover:border-orange-300 hover:shadow-md"
                      >
                        <div className="text-gray-700 mb-3">
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">{suggestion.title}</h3>
                        <p className="text-sm text-gray-500">{suggestion.subtitle}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Chat Messages */
              <div className="space-y-6">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    customerId={customerId}
                  />
                ))}
                {aiThinking && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-orange-500 to-orange-600">
                        <span className="text-white font-bold text-sm">FB</span>
                      </div>
                      <div className="bg-gray-100 p-4 rounded-2xl">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white border-t px-8 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                disabled={isLoading}
                className="w-full px-6 py-4 pr-14 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-800 placeholder-gray-400 disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center hover:shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-96 bg-white border-l flex flex-col">
        {/* User Profile */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-gray-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Test User</h3>
                <p className="text-sm text-gray-500">Free</p>
              </div>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronDown className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Order Now Button */}
        <div className="p-6">
          <button 
            onClick={() => sendMessage('View Menu', customerId)}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105"
          >
            ORDER NOW
          </button>
        </div>

        {/* Your Order Section */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your Order</h3>
            </div>
            {itemCount > 0 && (
              <span className="bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </div>

          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <ShoppingCart className="w-12 h-12 text-orange-500" />
              </div>
              <p className="text-gray-900 font-medium mb-2">Your cart is empty</p>
              <p className="text-sm text-gray-500 text-center px-6">
                Start adding items to see them here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => {
                console.log('🎨 Rendering cart item in sidebar:', item);

                const itemInstructions = specialInstructions?.[item.productId];
                
                return (
                <div key={item.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start gap-3">
                    {item.image && item.image !== '' && (
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-md"
                        onError={(e) => {
                          console.warn('❌ Image failed to load:', item.image);
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-gray-900 mb-1 truncate">
                        {item.name}
                      </h4>
                      <p className="text-xs text-gray-600 mb-2">
                        ${item.price.toFixed(2)} each
                      </p>

                      {/* ✅ Show special instructions if present */}
        {itemInstructions && (
          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mb-2">
            📝 {itemInstructions}
            </div>
        )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              console.log('➖ Minus button clicked for:', item.name, 'productId:', item.productId);
                              handleQuantityUpdate(item.productId, item.quantity, 'decrease');
                            }}
                            className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          
                          <span className="w-8 text-center font-semibold text-sm">
                            {item.quantity}
                          </span>
                          
                          <button
                            onClick={() => {
                              console.log('➕ Plus button clicked for:', item.name, 'productId:', item.productId);
                              handleQuantityUpdate(item.productId, item.quantity, 'increase');
                            }}
                            className="w-6 h-6 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        
                        <button
                          onClick={() => {
                            console.log('🗑️ Trash button clicked for:', item.name, 'productId:', item.productId);
                            handleRemoveItem(item.productId);
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-semibold text-sm text-gray-900">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              );
              })}

              <div className="border-t pt-4 mt-4">
                {/* Show subtotal, discount, and total if there's a discount */}
                {cartDiscount > 0 && cartCoupon ? (
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal:</span>
                      <span>${cartSubtotal.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm text-green-600 font-medium">
                      <span>Discount ({cartCoupon.code}):</span>
                      <span>-${cartDiscount.toFixed(2)}</span>
                    </div>
                    
                    <div className="pt-2 border-t border-gray-200" />
                  </div>
                ) : null}
                
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-bold text-gray-900">Total:</span>
                  <span className="text-xl font-bold text-orange-600">
                    ${cartTotal.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105"
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}