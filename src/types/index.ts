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

export interface ChatMessage {
  text: string;
  sender: 'me' | 'other';
  type?: 'welcome' | 'normal';
  intent?: string;
  products?: Product[];
  suggestions?: string[];
  timestamp?: Date;
  id?: string;
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