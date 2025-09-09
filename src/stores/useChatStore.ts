// src/stores/useChatStore.ts
import { create } from 'zustand';
import { api } from '../services/api/ApiClient';
import { useCartStore } from './useCartStore';
import type { ChatMessage, Product } from '../types';

interface ChatSession {
  id: string;
  customer_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  currentSession: ChatSession | null;
  customerId: string | null;
  sessionId: string;
  error: string | null;
  
  // Actions
  setCustomerId: (customerId: string) => void;
  sendMessage: (text: string) => Promise<void>;
  sendQuickAction: (action: string) => Promise<void>;
  addProductToCart: (product: Product) => Promise<void>;
  clearMessages: () => void;
  initializeChat: (customerId: string) => void;
  addMessage: (message: ChatMessage) => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  currentSession: null,
  customerId: null,
  sessionId: crypto.randomUUID(),
  error: null,

  setCustomerId: (customerId: string) => {
    set({ customerId });
  },

  initializeChat: (customerId: string) => {
    set({ 
      customerId,
      sessionId: crypto.randomUUID(),
      messages: [{
        text: "Welcome to FoodyBuddy! I'm here to help you order amazing food. What can I do for you today?",
        sender: 'other',
        type: 'welcome',
        suggestions: ['View Menu', 'Track Orders', "Today's Specials", 'Show my cart'],
        timestamp: new Date(),
        id: crypto.randomUUID()
      }],
      error: null
    });
  },

  sendMessage: async (text: string) => {
    const { customerId, sessionId } = get();
    
    if (!customerId) {
      set({ error: 'Customer ID not set' });
      return;
    }

    // Add user message immediately
    const userMessage: ChatMessage = {
      text: text.trim(),
      sender: 'me',
      timestamp: new Date(),
      id: crypto.randomUUID()
    };

    set(state => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null
    }));

    try {
      const response = await api.chat.sendAIMessage({
        text: text.trim(),
        customerId,
        sessionId
      });

      if (response.success) {
         console.log('🔍 Full API Response:', response);
  console.log('🔍 API Response data:', response.data);
  console.log('🔍 CartData from API:', response.data.cartData);
  console.log('🔍 OrderData from API:', response.data.orderData);
  console.log('🔍 OrderData type:', typeof response.data.orderData);
        const botMessage: ChatMessage = {
          text: response.data.cartData ? '' : response.data.aiText,
          sender: 'other',
          timestamp: new Date(),
          id: crypto.randomUUID(),
          intent: response.data.intent,
          products: response.data.productList,
          suggestions: response.data.meta.suggestions,
          payment: response.data.payment,
          cartData: response.data.cartData,
          orderData: response.data.orderData
        };
        console.log('🔍 Created botMessage:', botMessage);
        console.log('🔍 BotMessage orderData:', botMessage.orderData);

        set(state => ({
          messages: [...state.messages, botMessage],
          isLoading: false
        }));


        // Update cart if cart data is provided
        if (response.data.addToCart) {
          useCartStore.getState().updateFromChatData(response.data.addToCart);
        }
      } else {
        throw new Error('Failed to get AI response');
      }

    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: ChatMessage = {
        text: "Sorry, I'm having trouble right now. Please try again in a moment.",
        sender: 'other',
        timestamp: new Date(),
        id: crypto.randomUUID()
      };

      set(state => ({
        messages: [...state.messages, errorMessage],
        isLoading: false,
        error: 'Failed to send message'
      }));
    }
  },

  sendQuickAction: async (action: string) => {
    await get().sendMessage(action);
  },

  addProductToCart: async (product: Product) => {
    const { customerId } = get();
    
    if (!customerId) {
      set({ error: 'Customer ID not set' });
      return;
    }

    try {
      await useCartStore.getState().addItem(customerId, product.id, 1);
      
      // Add confirmation message
      const confirmMessage: ChatMessage = {
        text: `Added ${product.name} to your cart! ($${product.price})`,
        sender: 'other',
        timestamp: new Date(),
        id: crypto.randomUUID()
      };

      set(state => ({
        messages: [...state.messages, confirmMessage]
      }));

    } catch (error) {
      console.error('Add to cart error:', error);
      
      const errorMessage: ChatMessage = {
        text: `Sorry, I couldn't add ${product.name} to your cart. Please try again.`,
        sender: 'other',
        timestamp: new Date(),
        id: crypto.randomUUID()
      };

      set(state => ({
        messages: [...state.messages, errorMessage]
      }));
    }
  },

  addMessage: (message: ChatMessage) => {
    set(state => ({
      messages: [...state.messages, message]
    }));
  },

  clearMessages: () => {
    set({ messages: [], error: null });
  },

  clearError: () => {
    set({ error: null });
  }
}));