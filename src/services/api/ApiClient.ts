// src/services/api/ApiClient.ts
import type {
  ChatResponse,
  Product,
  CartData,
  CartItem,
  OrderResponse,
  OrderItem
} from '../../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

class ChatService {
  async getHistory(sessionId: string) {
    const apiUrl = `${API_BASE_URL}/api/v1/chat/sessions/${sessionId}/messages`;
    const res = await fetch(apiUrl);
    
    if (!res.ok) {
      throw new Error(`Failed to get chat history: ${res.status}`);
    }
    
    return res.json();
  }

  async sendAIMessage(data: {
    text: string;
    customerId: string;
    sessionId: string;
  }): Promise<ChatResponse> {
    const apiUrl = `${API_BASE_URL}/api/v1/chat/chat`;
    console.log('📡 Calling API:', apiUrl);
    console.log('📤 Request:', data);
    
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sessionId: data.sessionId,
        customerId: data.customerId,
        text: data.text
      })
    });
    
    console.log('📥 Response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ API Error:', errorText);
      throw new Error(`API call failed: ${res.status} - ${errorText}`);
    }
    
    const result = await res.json();
    console.log('✅ API Response:', result);
    return result;
  }

  async createSession(customerId: string, title?: string) {
    const apiUrl = `${API_BASE_URL}/api/v1/chat/sessions`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, title })
    });
    
    if (!res.ok) {
      throw new Error(`Failed to create session: ${res.status}`);
    }
    
    return res.json();
  }

  async getSessions(customerId: string) {
    const apiUrl = `${API_BASE_URL}/api/v1/chat/sessions?customerId=${customerId}`;
    const res = await fetch(apiUrl);
    
    if (!res.ok) {
      throw new Error(`Failed to get sessions: ${res.status}`);
    }
    
    return res.json();
  }
}

class CartService {
  async addToCart(data: {
    customerId: string;
    productId: string;
    quantity: number;
  }) {
    const apiUrl = `${API_BASE_URL}/api/v1/orders/cart/add`;
    
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to add to cart: ${res.status} - ${errorText}`);
    }
    return res.json();
  }

  async getCart(customerId: string) {
    const apiUrl = `${API_BASE_URL}/api/v1/orders/cart/${customerId}`;
    const res = await fetch(apiUrl);
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to get cart: ${res.status} - ${errorText}`);
    }
    return res.json();
  }

  async updateCartItem(data: {
    customerId: string;
    productId: string;
    quantity: number;
  }) {
    const apiUrl = `${API_BASE_URL}/api/v1/orders/cart/update`;
    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to update cart: ${res.status} - ${errorText}`);
    }
    return res.json();
  }

  async removeFromCart(customerId: string, productId: string) {
    const apiUrl = `${API_BASE_URL}/api/v1/orders/cart/${customerId}/${productId}`;
    const res = await fetch(apiUrl, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to remove from cart: ${res.status} - ${errorText}`);
    }
    return res.json();
  }

  async clearCart(customerId: string) {
    const apiUrl = `${API_BASE_URL}/api/v1/orders/cart/${customerId}`;
    const res = await fetch(apiUrl, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to clear cart: ${res.status} - ${errorText}`);
    }
    return res.json();
  }
}

class OrderService {
  async placeOrder(data: {
    customerId: string;
    items: OrderItem[];
    deliveryAddress?: string;
    paymentMethod?: string;
    specialInstructions?: string;
  }): Promise<OrderResponse> {
    const apiUrl = `${API_BASE_URL}/api/v1/orders/place`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to place order: ${res.status} - ${errorText}`);
    }
    return res.json();
  }

  async getOrderHistory(customerId: string, limit = 10, offset = 0) {
    const apiUrl = `${API_BASE_URL}/api/v1/orders/history/${customerId}?limit=${limit}&offset=${offset}`;
    const res = await fetch(apiUrl);
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to get order history: ${res.status} - ${errorText}`);
    }
    return res.json();
  }

  async getOrderDetails(orderId: string) {
    const apiUrl = `${API_BASE_URL}/api/v1/orders/${orderId}`;
    const res = await fetch(apiUrl);
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to get order details: ${res.status} - ${errorText}`);
    }
    return res.json();
  }
}

export class ApiClient {
  chat: ChatService;
  cart: CartService;
  orders: OrderService;

  constructor() {
    this.chat = new ChatService();
    this.cart = new CartService();
    this.orders = new OrderService();
  }

  // Test backend connection
  async testConnection() {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (res.ok) {
        const data = await res.json();
        console.log('✅ Backend connection successful:', data);
        return data;
      }
      throw new Error('Backend not responding');
    } catch (error) {
      console.error('❌ Backend connection failed:', error);
      throw error;
    }
  }
}

export const api = new ApiClient();