import { useState, useEffect, useRef } from 'react';
import { Send, Menu, MapPin, Tag, ShoppingCart, User, Link, Share2, MoreHorizontal, ChevronDown, Plus, Minus, Trash2 } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { useCartStore } from '../../stores/useCartStore';
import MessageBubble from './MessageBubble';
import { socket } from '../../lib/socket';

interface Props {
  customerId: string;
}

export default function ChatContainer({ customerId }: Props) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  // Chat store
  const { messages, isLoading, sendMessage, aiThinking, initializeChat, langchainEnabled, toggleLangChain, langchainSessionActive } = useChatStore();
  
  //  Cart store - with all properties including discount and coupon
  const { items: cartItems, total: cartTotal, subtotal: cartSubtotal, discount: cartDiscount, coupon: cartCoupon, specialInstructions, itemCount } = useCartStore();
  
  const [showWelcome, setShowWelcome] = useState(true);

  //  Debug: Log cart state whenever it changes
  useEffect(() => {
    console.log(' SIDEBAR Cart State:', {
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

 useEffect(() => {
    const handleCouponApplied = (data: any) => {
      console.log('[ChatInterface]  Coupon applied event:', data);
      if (data && data.code) {
        const subtotal = parseFloat(data.originalTotal) || 0;
        const discountAmount = parseFloat(data.discountAmount) || 0;
        const newTotal = parseFloat(data.newTotal) || 0;

        useCartStore.getState().updateCartWithDiscount(subtotal, discountAmount, newTotal, {
          code: data.code,
          discount: data.discount,
          description: `${data.discount}% off your order`,
        });
      }
    };

    const handleLangchainResponse = (data: any) => {
      console.log('[ChatInterface]  LangChain response:', data);

      
      if (
        data.clearCart ||
        data.clearCartAfterOrder ||
        data?.toolResults?.some((r: any) => r.manualPaymentSuccess)
      ) {
        console.log('[ChatInterface]  Clearing cart after successful order...');
        useCartStore.getState().clearCart();
      }

      //  Detect order/payment confirmation
      if (data.text && /payment successful|order confirmed/i.test(data.text)) {
        console.log('[ChatInterface]  Order confirmation:', data.text);
      }

      //  Detect payment link (mock payment)
      const paymentLink = data.toolResults?.find(
        (r: any) => r.link && r.link.includes('https://payments')
      )?.link;
      if (paymentLink) {
        console.log('[ChatInterface]  Payment link received:', paymentLink);
      }

      //  Detect email confirmation
      const emailResult = data.toolResults?.find((r: any) => r.sent || r.email);
      if (emailResult) {
        console.log('[ChatInterface]  Confirmation email sent:', emailResult);
      }
    };

    const handleSessionCleared = (data: any) => {
      console.log('[ChatInterface]  Session cleared:', data);
    };

    socket.on('coupon-applied', handleCouponApplied);
    socket.on('langchain-response', handleLangchainResponse);
    socket.on('session-cleared', handleSessionCleared);

    return () => {
      socket.off('coupon-applied', handleCouponApplied);
      socket.off('langchain-response', handleLangchainResponse);
      socket.off('session-cleared', handleSessionCleared);
    };
  }, []);

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
    
    console.log(' Quantity update clicked:', { productId, currentQuantity, action, itemName: item.name });
    
    if (action === 'decrease') {
      // Just say "remove one [item]" - backend will handle deletion if qty=1
      console.log(' Sending: remove one', item.name);
      sendMessage(`remove one ${item.name}`, customerId);
    } else {
      // Just say "add [item] to cart" - backend will increase quantity
      console.log('Sending: add', item.name, 'to cart');
      sendMessage(`add ${item.name} to cart`, customerId);
    }
  };

  const handleRemoveItem = (productId: string) => {
    const item = cartItems.find(i => i.productId === productId);
    if (item) {
      console.log(' Remove button clicked - sending: remove all', item.name);
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
    <div className="relative w-full h-screen bg-gray-50">
      {/* Minimized Chat Button - Bottom Right */}
      {isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full shadow-2xl hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center z-50 group"
        >
          <svg
            className="w-8 h-8 text-white group-hover:scale-110 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>
      )}

      {/* Full Chat Window */}
      {!isMinimized && (
        <div className="flex h-screen bg-gray-100">
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="bg-gray-100">
              {/* Top Row - Logo and User */}
              <div className="px-6 py-4 flex items-center justify-between">
                {/* Left: Logo and Title */}
                <div className="flex items-center space-x-3">
                  <img
                     src="https://www.foodybuddy.app/_next/image?url=%2Flogo.gif&w=256&q=75" // animated image URL
                     alt="FoodyBuddy Logo"
                     className="w-12 h-auto rounded-lg"
                     />
                  <h1 className="text-2xl font-bold text-gray-900">Foody Buddy</h1>
                  
                  {/* Exit/Minimize Icon */}
                  <button 
                    onClick={() => setIsMinimized(true)}
                    className="ml-2 p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors group"
                  >
                    <svg 
                      className="w-5 h-5 text-gray-600 group-hover:text-gray-900" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {/* Door bracket ] - reversed */}
                      <path d="M18 4v16" />
                      <path d="M15 4h3" />
                      <path d="M15 20h3" />
                      {/* Arrow pointing left */}
                      <path d="M13 12H3" />
                      <path d="M7 8l-4 4 4 4" />
                    </svg>
                  </button>
                </div>
                <div>
                </div>
              </div>
              </div>

              {/* Rounded Chat Container Starts */}
              <div className="bg-white rounded-3xl  ml-5 mr-0 mt-0 mb-1 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 90px)' }}>
                {/* Description and Actions Row */}
<div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
  {/* Left: Description and LangChain Toggle */}
  <div className="flex items-center space-x-4">
    <p className="text-sm text-black font-medium">Your personal food ordering assistant</p>
    
    {/* ✅ LangChain Toggle */}
    <label className="flex items-center space-x-2 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={langchainEnabled}
          onChange={toggleLangChain}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-500 transition-colors"></div>
        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
      </div>
      <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
        {langchainEnabled ? (
          <>🤖 AI Mode <span className="text-green-600">(with memory)</span></>
        ) : (
          <>💬 Standard Mode</>
        )}
      </span>
    </label>

    {/* Optional: Clear Session Button */}
    {langchainEnabled && langchainSessionActive && (
      <button
        onClick={() => {
          if (window.confirm('Clear conversation memory?')) {
            useChatStore.getState().clearLangChainSession(customerId);
          }
        }}
        className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
        title="Clear LangChain conversation memory"
      >
        Clear Memory
      </button>
    )}
  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {/* More Options - with dropdown */}
                    <div 
                      className="relative"
                      onMouseEnter={() => setShowQuickActions(true)}
                      onMouseLeave={() => setShowQuickActions(false)}
                    >
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreHorizontal className="w-5 h-5 text-gray-600" />
                      </button>
                      
                      {showQuickActions && (
                        <div className="absolute right-0 top-full pt-2 z-50">
                          <div className="bg-white rounded-xl shadow-lg border border-gray-200 py-2 w-56">
                            <button
                              onClick={() => {
                                handleSuggestionClick('View Menu');
                                setShowQuickActions(false);
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-gray-100 transition-colors flex items-center space-x-3"
                            >
                              <Menu className="w-5 h-5 text-gray-600" />
                              <span className="text-gray-800 font-medium">View Menu</span>
                            </button>
                            <button
                              onClick={() => {
                                handleSuggestionClick('Track Orders');
                                setShowQuickActions(false);
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3"
                            >
                              <MapPin className="w-5 h-5 text-gray-600" />
                              <span className="text-gray-800 font-medium">Track Orders</span>
                            </button>
                            <button
                              onClick={() => {
                                handleSuggestionClick('Show my cart');
                                setShowQuickActions(false);
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3"
                            >
                              <Tag className="w-5 h-5 text-gray-600" />
                              <span className="text-gray-800 font-medium">Show My Cart</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Link Icon */}
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
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

            {/* Chat Messages Area */}
           <div className="flex-1 overflow-y-auto bg-white">
              <div className="max-w-5xl mx-auto px-12">
                {showWelcome && messages.length === 0 ? (
                  /* Welcome Screen */
                  <div className="flex flex-col items-center justify-center py-8">
                    {/* Logo */}
                    <img
                     src="https://www.foodybuddy.app/_next/image?url=%2Flogo.gif&w=256&q=75" // animated image URL
                     alt="FoodyBuddy Logo"
                     className="w-20 h-auto rounded-lg"
                     />
                    
                    {/* Title */}
                    <h2 className="text-3xl font-bold text-gray-900 mb-6">Let&apos;s start a smart conversation</h2>
                    
                    {/* Suggestion Cards */}
                    <div className="grid grid-cols-3 gap-4 w-full mb-5">
                      {suggestions.map((suggestion, index) => {
                        const IconComponent = suggestion.icon;
                        return (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion.title)}
                            className="p-6 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all duration-200 text-left border border-gray-200 hover:shadow-sm"
                          >
                            <div className="text-gray-700 mb-3">
                              <IconComponent className="w-5 h-5 stroke-[1.5]" />
                            </div>
                            <h3 className="font-bold text-gray-900 mb-1 text-base">{suggestion.title}</h3>
                            <p className="text-sm text-gray-500">{suggestion.subtitle}</p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Input Box - Proper Size */}
                    <div className="w-full">
                      <div className="relative bg-white rounded-3xl border border-gray-200 shadow-sm">
                        <input
                          type="text"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Ask me anything..."
                          disabled={isLoading}
                          className="w-full px-8 py-8 pr-24 bg-transparent border-none focus:outline-none text-lg text-gray-800 placeholder-gray-300 rounded-3xl disabled:opacity-50"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={isLoading || !inputValue.trim()}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center hover:shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        >
                          <Send className="w-6 h-6 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Chat Messages */
                  <div className="py-8">
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

                    {/* Input at Bottom for Active Chat */}
                    
                    <div className="mt-8 pt-6 border-t sticky bottom-0 ">
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
                )}
              </div>
            </div>
          </div> 
          </div>
        
          {/* Right Sidebar */}
          <div className="w-96 bg-gray-100 flex flex-col">
            {/* User Profile - NO BORDER BELOW */}
            <div className="px-9 pt-2 pb-7">
               <div className="flex items-center justify-between p-2 rounded-xl bg-gray-200 hover:bg-gray-300">
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

            {/* Order Now Button - NO TOP PADDING, NO BORDER ABOVE */}
            <div className="px-7 pb-2">
              <button 
                onClick={() => sendMessage('View Menu', customerId)}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-500 text-white font-bold text-sm rounded-xl hover:shadow-sm transition-all duration-200 hover:scale-[1.02]"
              >
                ORDER NOW
              </button>
            </div>

            {/* Border Line - AFTER ORDER NOW BUTTON */}
            <div className="border-t border-gray-200"></div>

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
      )}
    </div>
  );
}