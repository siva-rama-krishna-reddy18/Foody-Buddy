// src/components/chat/MessageBubble.tsx
import React, { useState } from 'react';
import { ShoppingCart, Star, CreditCard, Lock, CheckCircle, Plus, Minus, Trash2 } from 'lucide-react';
import type { ChatMessage, Product } from '../../types/index';
import { Package, Truck, Clock, MoreHorizontal, RotateCcw } from 'lucide-react';

interface OrderItem {
  id: string;
  orderNumber: string;
  status: 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  date: string;
  total: number;
  estimatedDelivery?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface OrderTrackingData {
  type: 'order_tracking';
  orders: OrderItem[];
}

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface CartDisplay {
  text: string;
  type: 'cart_display';
  cartItems: CartItem[];
  cartTotal: number;
}

interface PaymentComponentProps {
  orderTotal: number;
  orderItems: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  onPaymentSuccess: () => void;
  onCancel: () => void;
}

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
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'preparing':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'ready':
        return <Package className="w-4 h-4 text-blue-500" />;
      case 'out_for_delivery':
        return <Truck className="w-4 h-4 text-purple-500" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <MoreHorizontal className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
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

  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-2">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
        <Package className="w-5 h-5 mr-2" />
        Your Recent Orders
      </h3>
      
      <div className="space-y-3">
        {orderData.orders.map((order) => (
          <div key={order.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
            {/* Order Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(order.status)}
                  <span className="font-medium text-gray-900">
                    Order #{order.orderNumber}
                  </span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {getStatusText(order.status)}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{order.date}</span>
                <span className="font-semibold text-gray-900">${order.total.toFixed(2)}</span>
              </div>
              
              {order.estimatedDelivery && order.status !== 'delivered' && (
                <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  Est. delivery: {order.estimatedDelivery}
                </div>
              )}
            </div>
            
            {/* Order Items */}
            <div className="p-4">
              <div className="space-y-2 mb-3">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="text-gray-600">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => onReorderClick?.(order.orderNumber || order.id)}
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center space-x-1 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reorder</span>
                </button>
                
                <button
                  onClick={() => onViewDetailsClick?.(order.orderNumber || order.id)}
                  className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Quick Actions */}
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

const PaymentChatComponent: React.FC<PaymentComponentProps> = ({
  orderTotal,
  orderItems,
  onPaymentSuccess,
  onCancel
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
    setPaymentStep('processing');
    
    // Simulate payment processing - replace with actual payment integration
    setTimeout(() => {
      setPaymentStep('success');
      setTimeout(() => {
        onPaymentSuccess();
      }, 2000);
    }, 3000);
  };

  if (paymentStep === 'processing') {
    return (
      <div className="bg-white rounded-2xl rounded-bl-md p-4 shadow-sm border max-w-sm mt-2">
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
      <div className="bg-white rounded-2xl rounded-bl-md p-4 shadow-sm border max-w-sm mt-2">
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
    return (
      <div className="bg-white rounded-2xl rounded-bl-md p-4 shadow-sm border max-w-sm mt-2">
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
          <div className="border-t pt-2 font-semibold flex justify-between">
            <span>Total:</span>
            <span>${orderTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => setPaymentStep('payment')}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium"
          >
            Proceed to Payment
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl rounded-bl-md p-4 shadow-sm border max-w-sm mt-2">
      <h3 className="font-semibold mb-3 flex items-center">
        <Lock className="w-4 h-4 mr-2 text-green-500" />
        Secure Payment - ${orderTotal.toFixed(2)}
      </h3>

      <div className="space-y-3">
        {/* Card Information */}
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

        {/* Cardholder Information */}
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

        {/* Payment Buttons */}
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

// Cart Display Component with Quantity Controls
const CartDisplayComponent = ({ cartData, onUpdateQuantity, onRemoveItem, onSuggestionClick }: {
  cartData: CartDisplay;
  onUpdateQuantity?: (productId: string, action: 'increase' | 'decrease') => void;
  onRemoveItem?: (productId: string) => void;
  onSuggestionClick?: (suggestion: string) => void;
}) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-2">
      <h3 className="font-semibold text-gray-800 mb-3">Your Cart</h3>
      
      <div className="space-y-3">
        {cartData.cartItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
            <div className="flex-1">
              <p className="font-medium text-gray-800">{item.name}</p>
              <p className="text-sm text-gray-600">${item.price.toFixed(2)} each</p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Quantity Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onUpdateQuantity?.(item.productId, 'decrease')}
                  className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 text-red-600 font-bold flex items-center justify-center transition-colors"
                  title="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                
                <span className="w-8 text-center font-semibold text-gray-800">
                  {item.quantity}
                </span>
                
                <button
                  onClick={() => onUpdateQuantity?.(item.productId, 'increase')}
                  className="w-8 h-8 rounded-full bg-green-100 hover:bg-green-200 text-green-600 font-bold flex items-center justify-center transition-colors"
                  title="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {/* Item Total */}
              <div className="text-right min-w-[60px]">
                <p className="font-semibold text-gray-800">${item.total.toFixed(2)}</p>
              </div>
              
              {/* Remove Button */}
              <button
                onClick={() => onRemoveItem?.(item.productId)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 flex items-center justify-center transition-colors"
                title="Remove item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Cart Total */}
      <div className="border-t border-gray-200 mt-4 pt-3">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-800">Total:</span>
          <span className="text-xl font-bold text-green-600">${cartData.cartTotal.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Checkout Button */}
      <button
        onClick={() => onSuggestionClick?.('Proceed to pay')}
        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
      >
        Proceed to Checkout
      </button>
    </div>
  );
};

interface Props {
  message: ChatMessage;
  onAddToCart?: (product: Product) => void;
  onSuggestionClick?: (suggestion: string) => void;
  onPaymentSuccess?: () => void;
  onUpdateCartQuantity?: (productId: string, action: 'increase' | 'decrease') => void;
  onRemoveFromCart?: (productId: string) => void;
  customerId?: string;
}

export default function MessageBubble({ 
  message, 
  onAddToCart, 
  onSuggestionClick, 
  onPaymentSuccess,
  onUpdateCartQuantity,
  onRemoveFromCart 
}: Props) {
  const { text, sender, products, suggestions, type, payment } = message;
  const isMe = sender === 'me';

  // Check if this is a cart display message
  const cartData = (message as any).cartData as CartDisplay | undefined;
  // Check if this is an order tracking message
  const orderData = (message as any).orderData as OrderTrackingData | undefined;

  console.log('MessageBubble - message:', message);
  console.log('MessageBubble - cartData:', cartData);
  console.log('MessageBubble - orderData:', orderData);

  const handlePaymentSuccess = () => {
    onPaymentSuccess?.();
    // You can also trigger a message to show order confirmation
    onSuggestionClick?.('Payment completed successfully! Your order is being prepared.');
  };

  const handlePaymentCancel = () => {
    onSuggestionClick?.('Payment cancelled. Let me know if you need help with anything else!');
  };

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 sm:mb-4`}>
      <div className="max-w-[85%] sm:max-w-[80%]">
        {/* Main message bubble - DON'T show text if we have cartData or orderData */}
        {!(cartData && !isMe) && !(orderData && !isMe) && text.trim() && (
          <div
            className={`px-3 py-2 sm:px-4 sm:py-3 rounded-2xl shadow-sm text-sm sm:text-base ${
              isMe 
                ? 'bg-blue-500 text-white rounded-br-md' 
                : 'bg-white text-gray-800 rounded-bl-md border'
            }`}
          >
            <p className="text-sm leading-relaxed whitespace-pre-line">{text}</p>
          </div>
        )}

        {/* Cart Display Component */}
        {cartData && !isMe && (
          <CartDisplayComponent 
            cartData={cartData}
            onUpdateQuantity={onUpdateCartQuantity}
            onRemoveItem={onRemoveFromCart}
            onSuggestionClick={onSuggestionClick}
          />
        )}

        {/* Order Tracking Component */}
        {orderData && !isMe && (
          <OrderTrackingComponent 
            orderData={orderData}
            onReorderClick={(orderId) => onSuggestionClick?.(`Reorder ${orderId}`)}
            onViewDetailsClick={(orderId) => onSuggestionClick?.(`Show details for order ${orderId}`)}
            onSuggestionClick={onSuggestionClick}
          />
        )}

        {/* Payment Component */}
        {payment && !isMe && (
          <PaymentChatComponent
            orderTotal={payment.total}
            orderItems={payment.items}
            onPaymentSuccess={handlePaymentSuccess}
            onCancel={handlePaymentCancel}
          />
        )}

        {/* Products */}
        {products && products.length > 0 && (
          <div className="mt-2 sm:mt-3 space-y-2">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-xl border p-3 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <h4 className="font-medium text-gray-900 text-sm sm:text-base mb-1">
                      {product.name}
                    </h4>
                    {product.description && (
                      <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-base sm:text-lg font-semibold text-blue-600">
                        ${product.price}
                      </span>
                      <div className="flex items-center text-xs text-gray-500">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
                        4.5
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onAddToCart?.(product)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg flex items-center space-x-1 text-xs sm:text-sm font-medium"
                  >
                    <ShoppingCart className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {(suggestions && suggestions.length > 0) || type === 'welcome' ? (
          <div className="mt-2 sm:mt-3 flex flex-wrap gap-2">
            {(suggestions || ['View Menu', 'Track Orders', "Today's Specials"]).map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 sm:px-3 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors border"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {/* Timestamp */}
        {message.timestamp && (
          <p className={`text-[10px] sm:text-xs mt-1 ${
            isMe ? 'text-right text-gray-500' : 'text-gray-500'
          }`}>
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        )}
      </div>
    </div>
  );
}
