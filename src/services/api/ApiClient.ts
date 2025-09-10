// src/services/api/ApiClient.ts
import type {
  ChatResponse,
  Product,
  CartData,
  CartItem,
  OrderResponse,
  OrderItem
} from '../../types';

class ChatService {
  async getHistory(sessionId: string) {
    console.log('Fetching chat history for session:', sessionId);
    await new Promise(r => setTimeout(r, 300));
    return [
      { text: `Welcome to chat session ${sessionId}!`, sender: 'other' as const },
      { text: 'Thanks, happy to be here.', sender: 'me' as const },
    ];
  }

  async sendAIMessage(data: {
    text: string;
    customerId: string;
    sessionId: string;
  }): Promise<ChatResponse> {
    const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/api/v1/chat/chat`;
    console.log('Calling API:', apiUrl);
    
    // ✅ FIXED: Match backend expectations exactly
    const requestBody = {
      sessionId: data.sessionId,
      customerId: data.customerId,  // ✅ Top-level field as expected by backend
      text: data.text               // ✅ Use 'text' field as expected by backend
    };
    
    console.log('Request body:', requestBody);
    
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('API Response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('API Error response:', errorText);
      throw new Error(`API call failed: ${res.status} - ${errorText}`);
    }
    
    const result = await res.json();
    console.log('API Response data:', result);
    return result;
  }
}

class CartService {
  async addToCart(data: {
    customerId: string;
    productId: string;
    quantity: number;
  }) {
    const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/api/v1/orders/cart/add`;
    console.log('Add to cart API:', apiUrl);
    
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
    const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/api/v1/orders/cart/${customerId}`;
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
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/orders/cart/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to update cart item: ${res.status} - ${errorText}`);
    }
    return res.json();
  }

  async removeFromCart(customerId: string, productId: string) {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/orders/cart/${customerId}/${productId}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to remove from cart: ${res.status} - ${errorText}`);
    }
    return res.json();
  }

  async clearCart(customerId: string) {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/orders/cart/${customerId}`, {
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
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/orders/place`, {
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
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/orders/history/${customerId}?limit=${limit}&offset=${offset}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to get order history: ${res.status} - ${errorText}`);
    }
    return res.json();
  }

  async getOrderDetails(orderId: string) {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/orders/${orderId}`);
    
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
}

export const api = new ApiClient();