// src/components/chat/ChatContainer.tsx
import { useEffect, useState } from 'react';
import { useChatStore } from '../../stores/useChatStore';
import ConnectionStatus from './ConnectionStatus';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import QuickActions from './QuickActions';
import CartDrawer from '../cart/CartDrawer'; // adjust path if needed

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export default function ChatContainer() {
  const customerId = '+1234567890';
  const { connect, disconnect } = useChatStore();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([
    // demo items for testing
    { id: '1', name: 'Margherita Pizza', quantity: 1, price: 12 },
    { id: '2', name: 'Veggie Burger', quantity: 2, price: 8 },
  ]);

  // Socket connection
  useEffect(() => {
    connect(customerId);
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto bg-white border rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">🤖</div>
        <div>
          <h3 className="font-semibold">FoodBot Assistant</h3>
          <p className="text-sm opacity-80">Your personal food ordering companion</p>
        </div>
      </div>

      <ConnectionStatus />

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
        <div className="flex gap-2 items-start">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm">🤖</div>
          <div className="bg-gray-100 p-3 rounded-2xl text-sm text-gray-700 max-w-[80%]">
            Welcome to Foody Buddy! I'm here to help you order delicious meals.
            <QuickActions />
          </div>
        </div>

        <MessageList />
      </div>

      {/* --- Keep this one as the ONLY Cart button --- */}
      <div className="p-2 border-t flex justify-center bg-gray-50">
        <button
          onClick={() => setIsCartOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          View Cart ({cartItems.length})
        </button>
      </div>

      {/* Input */}
      <MessageInput customerId={customerId} />

      {/* Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={(id, newQty) =>
          setCartItems((prev) =>
            prev.map((it) =>
              it.id === id ? { ...it, quantity: Math.max(1, newQty) } : it
            )
          )
        }
        onRemoveItem={(id) =>
          setCartItems((prev) => prev.filter((it) => it.id !== id))
        }
      />
    </div>
  );
}