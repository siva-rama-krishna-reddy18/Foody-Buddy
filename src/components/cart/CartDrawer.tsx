// src/components/cart/CartDrawer.tsx
import React from 'react';
import { X, Plus, Minus, ShoppingBag, CreditCard } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore';
import { api } from '../../services/api/ApiClient';
import { motion, AnimatePresence } from 'framer-motion';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
}

export default function CartDrawer({ isOpen, onClose, customerId }: Props) {
  const { items, isLoading, updateQuantity, removeItem, clearCart } = useCartStore();
  const [isOrdering, setIsOrdering] = React.useState(false);

  const handleQuantityChange = async (item: CartItem, newQuantity: number) => {
    if (newQuantity <= 0) {
      await removeItem(customerId, item.productId);
    } else {
      await updateQuantity(customerId, item.productId, newQuantity);
    }
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;

    setIsOrdering(true);
    try {
      const orderItems = items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));

      const response = await api.orders.placeOrder({
        customerId,
        items: orderItems,
        paymentMethod: 'CARD'
      });

      if (response.success) {
        await clearCart(customerId);
        alert(`Order placed successfully! Order #${response.data.orderNumber}`);
        onClose();
      }
    } catch (error) {
      console.error('Order placement error:', error);
      alert('Failed to place order.');
    } finally {
      setIsOrdering(false);
    }
  };

  const calculateTotal = () => items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Bottom Sheet */}
          <motion.div
            className="relative bg-white rounded-t-2xl shadow-xl max-h-[90%] w-full"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose(); // swipe down to close
            }}
          >
            {/* Drag handle */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto my-2" />

            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center space-x-2">
                <ShoppingBag className="h-5 w-5 text-gray-600" />
                <h2 className="text-base font-semibold text-gray-900">Your Cart</h2>
              </div>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Your cart is empty</div>
              ) : (
                items.map(item => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">${item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleQuantityChange(item, item.quantity - 1)} className="p-1 border rounded">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span>{item.quantity}</span>
                      <button onClick={() => handleQuantityChange(item, item.quantity + 1)} className="p-1 border rounded">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t p-4">
                <div className="flex justify-between mb-3">
                  <span className="font-medium">Total</span>
                  <span className="font-semibold">${calculateTotal().toFixed(2)}</span>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  disabled={isOrdering}
                  className="w-full bg-blue-500 text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{isOrdering ? 'Placing Order...' : 'Proceed to Payment'}</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}