import React, { useEffect, useState } from 'react';
import { ShoppingCart, Star, CreditCard, Lock, CheckCircle, Plus, Minus, Trash2, Package, Truck, Clock, MoreHorizontal, RotateCcw } from 'lucide-react';
import type { ChatMessage, Product } from '../../types/index';
import { socket } from '../../lib/socket';
import { useChatStore } from '../../stores/useChatStore';
import { useCartStore } from '../../stores/useCartStore';

interface OrderItem {
  id: string;
  orderNumber: string;
  status: 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  date: string;
  total: number;
  originalAmount?: number;
  discount?: number;
  couponCode?: string;
  estimatedDelivery?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    specialInstructions?: string;
  }>;
}

interface OrderTrackingData {
  type: 'order_tracking';
  orders: OrderItem[];
}

interface CartItem {
  id: string;
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CartDisplay {
  text: string;
  type: 'cart_display';
  cartItems: CartItem[];
  cartTotal: number;
}

interface PaymentData {
  total: number;
  subtotal?: number;
  discount?: number;
  coupon?: {
    code: string;
    discount: number;
    description: string;
  };
  specialInstructions?: {
    [key: string]: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface Props {
  message: ChatMessage;
  customerId: string;
}

// Order Tracking Component
const OrderTrackingComponent = ({ 
  orderData, 
  onReorderClick, 
  onViewDetailsClick,
  onSuggestionClick 
}: {
  orderData: OrderTrackingData;
  onReorderClick?: (orderId: string) => void;
  onViewDetailsClick?: (orderId: string) => void;
  onSuggestionClick?: (suggestion: string) => void;
}) => {
  if (!orderData || !orderData.orders || !Array.isArray(orderData.orders)) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 mt-2">
        <p className="text-gray-600 text-center">No orders available</p>
      </div>
    );
  }

  if (orderData.orders.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 mt-2">
        <p className="text-gray-600 text-center">You don't have any orders yet</p>
        <button
          onClick={() => onSuggestionClick?.('View Menu')}
          className="mt-3 w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'preparing': return <Clock className="w-4 h-4 text-orange-500" />;
      case 'ready': return <Package className="w-4 h-4 text-blue-500" />;
      case 'out_for_delivery': return <Truck className="w-4 h-4 text-purple-500" />;
      case 'delivered': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled': return <MoreHorizontal className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready for Pickup';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'preparing': return 'bg-orange-100 text-orange-800';
      case 'ready': return 'bg-blue-100 text-blue-800';
      case 'out_for_delivery': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isDetailedView = orderData.orders.length === 1;

  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-2">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
        <Package className="w-5 h-5 mr-2" />
        {isDetailedView ? 'Order Details' : 'Your Recent Orders'}
      </h3>
      
      <div className="space-y-3">
        {orderData.orders.map((order) => {
          const orderItems = order.items || [];
          const orderTotal = order.total || 0;
          const hasDiscount = order.discount != null && order.discount > 0;
          const originalAmount = order.originalAmount || orderTotal;
          
          return (
            <div key={order.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(order.status)}
                    <span className="font-medium text-gray-900">Order #{order.orderNumber}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{order.date}</span>
                  <span className="font-semibold text-gray-900">${orderTotal.toFixed(2)}</span>
                </div>
                
                {order.estimatedDelivery && order.status !== 'delivered' && (
                  <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    Est. delivery: {order.estimatedDelivery}
                  </div>
                )}
              </div>
              
              <div className="p-4">
                {!isDetailedView && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-700">
                      {orderItems.map((item, i) => (
                        <span key={i}>
                          {item.quantity}x {item.name}
                          {i < orderItems.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </p>
                  </div>
                )}

                {isDetailedView && (
                  <div className="space-y-2 mb-3">
                    {orderItems.map((item, index) => {
                      const itemPrice = typeof item.price === 'number' ? item.price : parseFloat(String(item.price)) || 0;
                      const itemQuantity = typeof item.quantity === 'number' ? item.quantity : parseInt(String(item.quantity)) || 1;
                      
                      return (
                        <div key={index}>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">
                              {itemQuantity}x {item.name || 'Unknown Item'}
                            </span>
                            <span className="text-gray-600">${(itemPrice * itemQuantity).toFixed(2)}</span>
                          </div>
                          {(item as any).specialInstructions && (
                            <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1">
                              📝 {(item as any).specialInstructions}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {isDetailedView && hasDiscount && (
                  <div className="border-t border-gray-200 pt-3 mb-3 space-y-2 text-sm bg-green-50 p-3 rounded-lg">
                    <div className="flex justify-between text-gray-700">
                      <span>Subtotal:</span>
                      <span className="font-medium">${originalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>💚 Discount {order.couponCode ? `(${order.couponCode})` : ''}:</span>
                      <span>-${order.discount!.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 border-t border-gray-300 pt-2">
                      <span>Total Paid:</span>
                      <span className="text-green-600">${orderTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-2 mt-3">
                  <button
                    onClick={() => onReorderClick?.(order.orderNumber || order.id)}
                    className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center space-x-1 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reorder</span>
                  </button>
                  
                  {!isDetailedView && (
                    <button
                      onClick={() => onViewDetailsClick?.(order.orderNumber || order.id)}
                      className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                    >
                      View Details
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <button
            onClick={() => onSuggestionClick?.('Place new order')}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            Place New Order
          </button>
          <button
            onClick={() => onSuggestionClick?.('View menu')}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            Browse Menu
          </button>
        </div>
      </div>
    </div>
  );
};

// Payment Component
const PaymentComponent = ({
  orderTotal,
  orderSubtotal = 0,
  orderDiscount = 0,
  orderCoupon,
  specialInstructions = {},
  orderItems,
  onPaymentSuccess,
  onCancel
}: {
  orderTotal: number;
  orderSubtotal?: number;
  orderDiscount?: number;
  orderCoupon?: { code: string; discount: number; description: string };
  specialInstructions?: { [key: string]: string };
  orderItems: Array<{ name: string; quantity: number; price: number }>;
  onPaymentSuccess: () => void;
  onCancel: () => void;
}) => {
  const [paymentStep, setPaymentStep] = useState<'review' | 'payment' | 'processing' | 'success'>('review');
  const [formData, setFormData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    name: '',
    email: '',
    address: '',
    phone: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleProcessPayment = async () => {
    console.log('💳 Processing payment...');
    setPaymentStep('processing');
    
    setTimeout(() => {
      console.log('✅ Payment processed, showing success');
      setPaymentStep('success');
      
      setTimeout(() => {
        console.log('🎉 Calling onPaymentSuccess');
        onPaymentSuccess();

        useCartStore.getState().clearCart('');
      }, 1500);
    }, 2000);
  };

  if (paymentStep === 'processing') {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border max-w-sm mt-2">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Processing your payment...</p>
          <p className="text-xs text-gray-500 mt-1">Please don't close this window</p>
        </div>
      </div>
    );
  }

  if (paymentStep === 'success') {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border max-w-sm mt-2">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="font-semibold text-green-600 mb-2">Payment Successful!</h3>
          <p className="text-sm text-gray-600">Your order has been confirmed</p>
          <p className="text-xs text-gray-500 mt-2">Order confirmation sent to your email</p>
        </div>
      </div>
    );
  }

  if (paymentStep === 'review') {
    const hasDiscount = orderDiscount && orderDiscount > 0;
    const hasInstructions = specialInstructions && Object.keys(specialInstructions).length > 0;

    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border max-w-sm mt-2">
        <h3 className="font-semibold mb-3 flex items-center">
          <CreditCard className="w-4 h-4 mr-2" />
          Order Summary
        </h3>
        
        <div className="space-y-2 mb-4">
          {orderItems.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>{item.name} x{item.quantity}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          
          {hasInstructions && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
              <p className="font-semibold text-blue-800 mb-1">📝 Special Instructions:</p>
              {Object.entries(specialInstructions || {}).map(([productId, instruction]) => 
                instruction ? (
                  <p key={productId} className="text-blue-700 mt-1">{instruction}</p>
                ) : null
              )}
            </div>
          )}
          
          <div className="border-t pt-2 space-y-1 mt-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">${(orderSubtotal || orderTotal).toFixed(2)}</span>
            </div>
            
            {hasDiscount && (
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>Discount {orderCoupon ? `(${orderCoupon.code})` : ''}:</span>
                <span>-${orderDiscount.toFixed(2)}</span>
              </div>
            )}
            
            <div className="font-bold flex justify-between pt-2 border-t text-base">
              <span>Total:</span>
              <span className="text-green-600">${orderTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => setPaymentStep('payment')}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            Proceed to Payment
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border max-w-sm mt-2">
      <h3 className="font-semibold mb-3 flex items-center">
        <Lock className="w-4 h-4 mr-2 text-green-500" />
        Secure Payment - ${orderTotal.toFixed(2)}
      </h3 >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Card Number</label>
          <input
            type="text"
            placeholder="1234 5678 9012 3456"
            value={formData.cardNumber}
            onChange={(e) => handleInputChange('cardNumber', formatCardNumber(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={19}
          />
        </div>

        <div className="flex space-x-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Expiry</label>
            <input
              type="text"
              placeholder="MM/YY"
              value={formData.expiryDate}
              onChange={(e) => handleInputChange('expiryDate', formatExpiryDate(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={5}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">CVV</label>
            <input
              type="text"
              placeholder="123"
              value={formData.cvv}
              onChange={(e) => handleInputChange('cvv', e.target.value.replace(/\D/g, '').substring(0, 3))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={3}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Cardholder Name</label>
          <input
            type="text"
            placeholder="John Doe"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Address</label>
          <input
            type="text"
            placeholder="123 Main St, City, State 12345"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            placeholder="(555) 123-4567"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex space-x-2 pt-2">
          <button
            onClick={handleProcessPayment}
            disabled={!formData.cardNumber || !formData.name || !formData.email}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg text-sm font-medium"
          >
            Pay ${orderTotal.toFixed(2)}
          </button>
          <button
            onClick={() => setPaymentStep('review')}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
          >
            Back
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-2">
          🔒 Your payment information is secure and encrypted
        </p>
      </div>
    </div>
  );
};

// Cart Display Component
// Cart Display Component
const CartDisplayComponent = ({
  cartData,
  customerId,
  onSuggestionClick
}: {
  cartData: any;
  customerId: string;
  onSuggestionClick: (action: string) => void;
}) => {
  const cartStoreInstructions = useCartStore((state) => state.specialInstructions);
  const [specialInstructions, setSpecialInstructions] = useState<{[key: string]: string}>({});
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');

  useEffect(() => {
    if (cartStoreInstructions) {
      setSpecialInstructions(cartStoreInstructions);
    }
  }, [cartStoreInstructions]);

  const cartStoreCoupon = useCartStore((state) => state.coupon);

  useEffect(() => {
    if (cartStoreCoupon) {
      setAppliedCoupon(cartStoreCoupon);
      setCouponCode(cartStoreCoupon.code);
    }
  }, [cartStoreCoupon]);
  
  if (!cartData) {
    return null;
  }

  const items = cartData.cartItems || [];
  
  // ✅ Calculate the actual subtotal from items
  const calculatedSubtotal = items.reduce((sum: number, item: any) => {
    const price = parseFloat(item.unit_price || item.price || 0);
    const quantity = parseInt(item.quantity || 1);
    return sum + (price * quantity);
  }, 0);

  // ✅ Get values from cart store
  const cartStoreSubtotal = useCartStore((state) => state.subtotal);
  const cartStoreDiscount = useCartStore((state) => state.discount);
  const cartStoreTotal = useCartStore((state) => state.total);

  // ✅ Use cart store values if available (after coupon applied), otherwise calculate
  const subtotal = cartStoreSubtotal > 0 ? cartStoreSubtotal : calculatedSubtotal;
  const discount = cartStoreDiscount > 0 ? cartStoreDiscount : 0;  // ✅ Use cart store discount
  const total = cartStoreTotal > 0 ? cartStoreTotal : subtotal;     // ✅ Use cart store total

  console.log('🛒 Cart Data:', cartData);
  console.log('🛒 Cart Items:', items);
  console.log('💰 Calculations:', { 
    calculatedSubtotal,
    cartStoreSubtotal,
    cartStoreDiscount,
    cartStoreTotal,
    subtotal, 
    discount, 
    total, 
    appliedCoupon 
  });

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <p className="text-gray-600 text-center">Your cart is empty</p>
      </div>
    );
  }

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    // ✅ Send message to backend to apply coupon
    onSuggestionClick(`apply coupon ${couponCode.toUpperCase()}`);
  };

  const handleRemoveCoupon = () => {
  // ✅ Send message to backend to remove coupon
  onSuggestionClick('remove coupon');
  
  // Clear local state
  setAppliedCoupon(null);
  setCouponCode('');
  setCouponError('');
};

  const handleUpdateQuantity = (productId: string, action: 'increase' | 'decrease') => {
    console.log('🔼 Updating quantity:', { productId, action });
    socket.emit('update-cart-quantity', { customerId, productId, action });
  };

  const handleRemoveItem = (productId: string) => {
    console.log('🗑️ Removing item:', productId);
    socket.emit('remove-from-cart', { customerId, productId });
  };

  const handleProceedToCheckout = () => {
    const checkoutData = {
      action: 'Proceed to pay',
      specialInstructions,
      coupon: appliedCoupon
    };
    onSuggestionClick(JSON.stringify(checkoutData));
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 max-w-md">
      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
        <ShoppingCart className="w-5 h-5" />
        Your Cart
      </h3>

      <div className="space-y-3">
        {items.map((item: any, index: number) => {
          // ✅ Fix: Handle different property names from backend
          const itemName = item.title || item.name || item.product || 'Unknown Item';
          const itemPrice = parseFloat(item.unit_price || item.price || 0);
          const itemQuantity = parseInt(item.quantity || 1);
          const itemTotal = itemPrice * itemQuantity;
          const itemImage = item.image || item.imageUrl;
          const itemId = item.productId || item.id;

          console.log('📦 Cart Item:', {
            itemName,
            itemPrice,
            itemQuantity,
            itemTotal,
            itemId,
            rawItem: item
          });

          return (
            <div key={item.id || index} className="border-b pb-3">
              <div className="flex items-center gap-3">
                {itemImage && (
                  <img 
                    src={itemImage} 
                    alt={itemName} 
                    className="w-16 h-16 object-cover rounded-md"
                    onError={(e) => { 
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none'; 
                    }}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate">{itemName}</h4>
                  <p className="text-gray-600 text-xs">${itemPrice.toFixed(2)} each</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateQuantity(itemId, 'decrease')}
                    className="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  
                  <span className="w-8 text-center font-semibold">{itemQuantity}</span>
                  
                  <button
                    onClick={() => handleUpdateQuantity(itemId, 'increase')}
                    className="w-7 h-7 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-right">
                  <p className="font-semibold text-sm">${itemTotal.toFixed(2)}</p>
                </div>

                <button
                  onClick={() => handleRemoveItem(itemId)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-2">
  <input
    type="text"
    placeholder="Special instructions (optional)"
    value={specialInstructions[itemId] || ''}
    onChange={(e) => {
      const newInstructions = {
        ...specialInstructions,
        [itemId]: e.target.value
      };
      setSpecialInstructions(newInstructions);
      
      // ✅ Sync to cart store
      useCartStore.getState().setSpecialInstructions(newInstructions);
    }}
    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
  />
</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Have a coupon code?
        </label>
        
        {!appliedCoupon ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value.toUpperCase());
                setCouponError('');
              }}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleApplyCoupon}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-800">{appliedCoupon.code}</p>
                <p className="text-xs text-green-600">{appliedCoupon.description}</p>
              </div>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Remove
            </button>
          </div>
        )}
        
        {couponError && (
          <p className="text-xs text-red-500 mt-1">{couponError}</p>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-medium">${subtotal.toFixed(2)}</span>
        </div>
        
        {appliedCoupon && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Discount ({appliedCoupon.discount}%):</span>
            <span>-${discount.toFixed(2)}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="font-bold text-lg">Total:</span>
          <span className="font-bold text-xl text-green-600">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-2 mt-4">
        <button
          onClick={handleProceedToCheckout}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <CreditCard className="w-5 h-5" />
          Proceed to Checkout (${total.toFixed(2)})
        </button>
        
        <button
          onClick={() => onSuggestionClick('Add more items')}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition-colors"
        >
          Add More Items
        </button>
      </div>
    </div>
  );
};

// Main MessageBubble Component
export default function MessageBubble({ message, customerId }: Props) {
  const { sendMessage } = useChatStore();
  const { text, sender, products, suggestions } = message;
  const cartData = (message as any).cartData as CartDisplay | undefined;
  const orderData = (message as any).orderData as OrderTrackingData | undefined;
  const payment = (message as any).payment as PaymentData | undefined;

  // ✅ Fixed: Proper type checking
  const isUser = sender === 'user' || sender === 'me';
  const isBot = sender === 'bot';
  
  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion, customerId);
  };

  const handleAddToCart = (product: Product) => {
    sendMessage(`add ${product.name} to cart`, customerId);
  };

  const handlePaymentSuccess = () => {
    console.log('🎉 Payment success handler called');
    sendMessage('PAYMENT SUCCESSFUL.PREPARING YOUR ORDER', customerId);
  };

  const handlePaymentCancel = () => {
    sendMessage('Payment cancelled', customerId);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start space-x-3 max-w-2xl ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isBot 
            ? 'bg-gradient-to-br from-orange-500 to-orange-600' 
            : 'bg-gradient-to-br from-purple-500 to-purple-700'
        }`}>
          <span className="text-white font-bold text-sm">
            {isBot ? 'FB' : 'TU'}
          </span>
        </div>

        {/* Message Content */}
        <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
          <div className={`flex items-center space-x-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <span className="text-sm font-semibold text-gray-700">
              {isBot ? 'Foody Buddy Assistant' : 'Test User'}
            </span>
            <span className="text-xs text-gray-400">
              {message.timestamp ? new Date(message.timestamp).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit' 
              }) : ''}
            </span>
          </div>

          {/* Text Message */}
          {!(cartData && !isUser) && !(orderData && !isUser) && text && text.trim() && (
            <div className={`p-4 rounded-2xl ${
              isBot 
                ? 'bg-gray-100 text-gray-800' 
                : 'bg-gray-200 text-gray-800'
            }`}>
              <p className="text-sm leading-relaxed">{text}</p>
            </div>
          )}

          {/* Product List */}
{products && products.length > 0 && (
  <div className="mt-3 grid grid-cols-2 gap-3">
    {products.map((product, index) => (
      <div 
        key={`${product.id}-${product.name}-${index}`}
        className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200"
      >
        <img 
          src={product.image || 'https://via.placeholder.com/150'} 
          alt={product.name}
          className="w-full h-32 object-cover rounded-lg mb-3"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://via.placeholder.com/150';
          }}
        />
        <h3 className="font-semibold text-gray-900 mb-1 text-sm">{product.name}</h3>
        <p className="text-orange-600 font-bold mb-3 text-lg">${product.price}</p>
        <button 
          onClick={() => handleAddToCart(product)}
          className="w-full py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
        >
          Add to Cart
        </button>
      </div>
    ))}
  </div>
)}

          {/* Cart Display */}
          {cartData && !isUser && (
            <CartDisplayComponent 
              cartData={cartData}
              customerId={customerId}
              onSuggestionClick={handleSuggestionClick}
            />
          )}

          {/* Order Tracking */}
          {orderData && !isUser && (
            <OrderTrackingComponent 
              orderData={orderData}
              onReorderClick={(orderId) => handleSuggestionClick(`Reorder ${orderId}`)}
              onViewDetailsClick={(orderId) => handleSuggestionClick(`Show details for order ${orderId}`)}
              onSuggestionClick={handleSuggestionClick}
            />
          )}

          {/* Payment */}
          {payment && !isUser && (
            <PaymentComponent
              orderTotal={payment.total}
              orderSubtotal={payment.subtotal}
              orderDiscount={payment.discount}
              orderCoupon={payment.coupon}
              specialInstructions={payment.specialInstructions}
              orderItems={payment.items}
              onPaymentSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />
          )}

          {/* Suggestions */}
          {suggestions && suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-medium transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}