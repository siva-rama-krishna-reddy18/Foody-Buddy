import { create } from 'zustand';
import { socket } from '../lib/socket';
import { useCartStore } from './useCartStore';
import type { ChatMessage } from '../types';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  aiThinking: boolean;
  error: string | null;

  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;

  sendMessage: (text: string, customerId: string) => Promise<void>;
  initializeChat: (customerId: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  aiThinking: false,
  error: null,

  cart: [],

  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((i) => i.id === item.id);
      if (existing) {
        return {
          cart: state.cart.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { cart: [...state.cart, { ...item, quantity: 1 }] };
    }),

  removeFromCart: (id) =>
    set((state) => ({
      cart: state.cart.filter((item) => item.id !== id),
    })),

  clearCart: () => set({ cart: [] }),

  initializeChat: (customerId: string) => {
    console.log('[Chat] Initializing chat for customer:', customerId);
    
    socket.off('bot-message');
    
    socket.on('bot-message', (data) => {
      console.log('[Chat] Received bot-message:', data);
      
      // ✅ Clear cart on payment success
      if (data.intent === 'PAYMENT_SUCCESS') {
        console.log('💳 [Chat] Payment successful, clearing cart store');
        useCartStore.getState().clearCart('');
      }
      
      // ✅ Update cart store when cart data arrives
      if (data.cart) {
        console.log('🛒 [Chat] Updating cart store with:', data.cart);
        useCartStore.getState().updateFromChatData(data.cart);
      } else if (data.intent === 'REMOVE_FROM_CART' || 
                 data.intent === 'DECREASE_QUANTITY' ||
                 data.intent === 'VIEW_CART') {
        console.log('🛒 [Chat] Cart-related intent but no cart data - clearing cart');
        useCartStore.getState().updateFromChatData(null);
      }
      
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        text: data.text || '',
        sender: 'bot',
        timestamp: data.timestamp || new Date().toISOString(),
        products: data.products || [],
        suggestions: data.suggestions || [],
        cartData: data.cart || undefined,
        orderData: data.orderData || undefined,
        payment: data.payment || undefined,
      };

      set(state => ({
        messages: [...state.messages, botMessage],
        isLoading: false,
        aiThinking: false
      }));
    });

    socket.on('connect', () => {
      console.log('[Chat] Socket connected');
    });

    socket.on('disconnect', () => {
      console.log('[Chat] Socket disconnected');
    });
  },

  sendMessage: async (text: string, customerId: string) => {
    // ✅ Check if message is JSON - if so, don't display it in chat
    const isJSON = text.trim().startsWith('{') && text.trim().endsWith('}');
    
    if (!isJSON) {
      // Only add to chat if it's NOT JSON
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        text,
        sender: 'user',
        timestamp: new Date().toISOString(),
      };

      set(state => ({
        messages: [...state.messages, userMessage],
        isLoading: true,
        aiThinking: true,
        error: null
      }));
    } else {
      // For JSON messages, just set loading state without adding message
      console.log('[Chat] 📦 Sending JSON data (not displaying in chat)');
      set(state => ({
        isLoading: true,
        aiThinking: true,
        error: null
      }));
    }

    socket.emit('chat-message', {
      customerId,
      message: text,
      sessionId: socket.id
    });
  },

  clearMessages: () => set({ messages: [], error: null })
}));