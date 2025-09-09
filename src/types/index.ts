// src/types/index.ts
export interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
  image_url?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface CartData {
  items: CartItem[];
  total: number;
  itemCount: number;
}

export interface OrderTrackingData {
  type: 'order_tracking';
  orders: Array<{
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
  }>;
}

export interface ChatMessage {
  id?: string;
  text: string;
  sender: 'me' | 'bot' | 'other';
  timestamp?: Date;
  products?: Product[];
  suggestions?: string[];
  type?: string;
  intent?: string;
  payment?: {
    total: number;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
  };
  cartData?: {  // ADD THIS FIELD
    type: 'cart_display';
    cartItems: Array<{
      id: string;
      productId: string;
      name: string;
      price: number;
      quantity: number;
      total: number;
    }>;
    cartTotal: number;
  };
   orderData?: OrderTrackingData;
}

export interface ChatResponse {
  success: boolean;
  data: {
    userMessage: string;
    aiMessage: string;
    aiText: string;
    intent: string;
    productList: Product[];
    addToCart: CartData | null;
    payment?: {
      total: number;
      items: Array<{
        name: string;
        quantity: number;
        price: number;
      }>;
    };
    cartData?: {  // ADD THIS FIELD
      type: 'cart_display';
      cartItems: Array<{
        id: string;
        productId: string;
        name: string;
        price: number;
        quantity: number;
        total: number;
      }>;
      cartTotal: number;
    };
    orderData?: OrderTrackingData; 
    meta: {
      suggestions: string[];
      timestamp: string;
    };
  };
}


export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface OrderResponse {
  success: boolean;
  data: {
    orderId: string;
    orderNumber: number;
    totalAmount: number;
    status: string;
    estimatedDelivery: string;
  };
}

export interface Order {
  id: string;
  orderNumber: number;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
  deliveryAddress?: string;
  paymentMethod?: string;
  specialInstructions?: string;
  estimatedDelivery?: string;
}