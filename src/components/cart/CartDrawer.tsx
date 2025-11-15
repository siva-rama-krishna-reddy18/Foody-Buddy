// src/components/cart/CartDrawer.tsx
import React from 'react';
import { X, Plus, Minus, ShoppingBag, CreditCard } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore';
import { api } from '../../services/api/ApiClient';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
  customerId?: string;
  onStartPayment?: () => void; // Add this prop
}

export default function CartDrawer({ 
  isOpen = false, 
  onClose = () => {}, 
  customerId = '',
  onStartPayment // Add this parameter
}: Props) {
  const { items, isLoading, updateQuantity, removeItem, clearCart } = useCartStore();
  const [isOrdering, setIsOrdering] = React.useState(false);

  // Helper functions for safe price handling
  const formatPrice = (price: any): string => {
    const numPrice = typeof price === 'number' ? price : parseFloat(price || 0);
    return isNaN(numPrice) ? '0.00' : numPrice.toFixed(2);
  };

  const calculateItemTotal = (item: CartItem): number => {
    const numPrice = typeof item.price === 'number' ? item.price : parseFloat(item.price || 0);
    return isNaN(numPrice) ? 0 : numPrice * item.quantity;
  };

  const safePrice = (price: any): number => {
    const numPrice = typeof price === 'number' ? price : parseFloat(price || 0);
    return isNaN(numPrice) ? 0 : numPrice;
  };

  // Safety check - don't render if no customerId
  if (!customerId) {
    console.warn('CartDrawer: No customerId provided');
    return null;
  }

  const handleQuantityChange = async (item: CartItem, newQuantity: number) => {
    console.log('Button clicked! Updating:', item.name, 'from', item.quantity, 'to', newQuantity);
    console.log('Customer ID:', customerId);
    console.log('Item details:', item);
    
    try {
      if (newQuantity <= 0) {
        await removeItem(customerId, item.productId);
      } else {
        await updateQuantity(customerId, item.productId, newQuantity);
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Failed to update quantity. Please try again.');
    }
  };

  const handleRemoveItem = async (item: CartItem) => {
    try {
      await removeItem(customerId, item.productId);
    } catch (error) {
      console.error('Error removing item:', error);
      alert('Failed to remove item. Please try again.');
    }
  };

  // Updated handlePlaceOrder to use onStartPayment
  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    
    // Close the cart drawer
    onClose();
    
    // Trigger chat payment flow if function is available
    if (onStartPayment) {
      onStartPayment();
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
      />
      
      {/* Cart Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
            <div className="flex items-center space-x-2">
              <ShoppingBag className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Your Order</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingBag className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Your cart is empty</h3>
                <p className="text-gray-600 text-sm">Add items from the menu to get started!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 text-sm">{item.name}</h3>
                        <p className="text-blue-600 font-semibold">${formatPrice(item.price)}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item)}
                        className="text-red-500 hover:text-red-700 p-1"
                        disabled={isLoading}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleQuantityChange(item, item.quantity - 1)}
                          className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                          disabled={isLoading}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-medium text-gray-900 min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item, item.quantity + 1)}
                          className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                          disabled={isLoading}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-semibold text-gray-900">
                        ${formatPrice(calculateItemTotal(item))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-gray-900">
                  ${formatPrice(calculateTotal())}
                </span>
              </div>
              
              <div className="text-xs text-gray-600 text-center">
                {getTotalItems()} item{getTotalItems() !== 1 ? 's' : ''} • Delivery in 30-45 mins
              </div>

              {/* Updated Place Order button to redirect to chat */}
              <button
                onClick={handlePlaceOrder}
                disabled={isLoading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                <CreditCard className="h-4 w-4" />
                <span>Proceed to Chat Checkout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
