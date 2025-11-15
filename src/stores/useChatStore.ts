// src/stores/useChatStore.ts - FIXED VERSION
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
  langchainEnabled: boolean;
  langchainSessionActive: boolean;
  cart: CartItem[];
  
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  sendMessage: (text: string, customerId: string) => Promise<void>;
  initializeChat: (customerId: string) => void;
  clearMessages: () => void;
  toggleLangChain: () => void;
  clearLangChainSession: (customerId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  aiThinking: false,
  error: null,
  langchainEnabled: true,
  langchainSessionActive: false,
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

  toggleLangChain: () => {
    const currentState = get();
    const newState = !currentState.langchainEnabled;
    console.log('🔄 [LangChain] Toggled:', newState ? 'ON' : 'OFF');
    set({ langchainEnabled: newState });
  },

  clearLangChainSession: (customerId: string) => {
    console.log('🧹 [LangChain] Clearing session for:', customerId);
    socket.emit('clear-langchain-session', { customerId });
    set({ langchainSessionActive: false });
  },

  initializeChat: (customerId: string) => {
    console.log('[Chat] Initializing chat for customer:', customerId);
    
    // Remove old listeners
    socket.off('bot-message');
    socket.off('langchain-response');
    
    // Regular bot messages
    socket.on('bot-message', (data) => {
      console.log('[Chat] Received bot-message:', data);
      
      if (data.intent === 'PAYMENT_SUCCESS') {
        console.log('[Chat] Payment successful, clearing cart store');
        useCartStore.getState().clearCart('');
      }
      
      if (data.cart) {
        console.log('[Chat] Updating cart store with:', data.cart);
        useCartStore.getState().updateFromChatData(data.cart);
      } else if (data.intent === 'REMOVE_FROM_CART' || 
                 data.intent === 'DECREASE_QUANTITY' ||
                 data.intent === 'VIEW_CART') {
        console.log('[Chat] Cart-related intent but no cart data - clearing cart');
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

    // ✅ FIXED: LangChain responses
    socket.on('langchain-response', (data) => {
      console.log('[Chat] 🤖 Received langchain-response:', data);
      
      // ✅ CRITICAL: Extract text FIRST before any processing
      const botText = data.text || '';
      console.log('[Chat] 📝 Bot text extracted:', botText);
      console.log('[Chat] 📝 Text length:', botText.length);
      
      // ✅ CRITICAL: Validate text exists
      if (!botText || botText.trim() === '') {
        console.error('[Chat] ❌ ERROR: Empty text received from backend!');
        console.error('[Chat] 📦 Full data received:', JSON.stringify(data, null, 2));
      }
      
      set({ langchainSessionActive: true });

      const currentCart = useCartStore.getState();
      const shouldPreserveCoupon = currentCart.coupon && currentCart.discount > 0;
      
      if (shouldPreserveCoupon) {
        console.log('[Chat] 🎟️ COUPON ACTIVE - Preserving discount');
      }

      if (data.cartData && !shouldPreserveCoupon) {
        console.log('[Chat] 🛒 Updating cart from LangChain:', data.cartData);
        useCartStore.getState().updateFromChatData(data.cartData);
      }
      
      let products: any[] = [];
      let cartData: any = null;
      let orderData: any = null;
      let paymentData: any = null;

      // Extract data from toolResults
      if (data.toolResults && Array.isArray(data.toolResults)) {
        // Products
        const productResults = data.toolResults.find((r: any) => r.items && Array.isArray(r.items));
        if (productResults && productResults.items) {
          products = productResults.items;
          console.log('[Chat] 📦 Extracted', products.length, 'products');
        }

        // Cart
        const cartResult = data.toolResults.find((r: any) => r.cart);
        if (cartResult && cartResult.cart) {
          cartData = cartResult.cart;
          console.log('[Chat] 🛒 Extracted cart data');
        }

        // Orders
        const orderTool = data.toolResults.find((r: any) => r.orders || r.order);
        if (orderTool) {
          if (orderTool.orders) {
            orderData = {
              type: 'order_tracking',
              orders: orderTool.orders.map((o: any) => ({
                id: o.orderNumber?.toString() || crypto.randomUUID(),
                orderNumber: o.orderNumber,
                status: o.status,
                date: o.date,
                total: o.total,
                discountAmount: o.discountAmount,
                couponCode: o.couponCode,
                items: o.items || [],
              }))
            };
          } else if (orderTool.order) {
            const o = orderTool.order;
            orderData = {
              type: 'order_tracking',
              orders: [{
                id: o.orderNumber?.toString() || crypto.randomUUID(),
                orderNumber: o.orderNumber,
                status: o.status,
                date: o.date,
                subtotal: parseFloat(o.subtotal) || 0,
                discountAmount: parseFloat(o.discountAmount) || 0,
                finalTotal: parseFloat(o.finalTotal) || parseFloat(o.total) || 0,
                couponCode: o.couponCode || 'N/A',
                items: o.items || [],
              }]
            };
          }
          console.log('[Chat] 📦 Extracted order data');
        }

        // Payment
        const paymentResult = data.toolResults.find((r: any) => r.needsPayment || r.payment);
        if (paymentResult) {
          paymentData = paymentResult.payment || paymentResult;
          console.log('[Chat] 💳 Extracted payment data');
        }
      }

      // ✅ CRITICAL: Create message with the extracted text
      const langchainMessage: ChatMessage = {
        id: `langchain-${Date.now()}`,
        text: botText, // ✅ Use the extracted text directly
        sender: 'bot',
        timestamp: data.timestamp || new Date().toISOString(),
        products: data.products || products,
        suggestions: data.metadata?.suggestions || ['View Menu', 'Show my cart'],
        cartData: data.cartData || cartData || undefined,
        orderData: data.orderData || orderData || undefined,
        payment: paymentData || undefined,
      };

      // ✅ CRITICAL: Log what we're about to add
      console.log('[Chat] ✅ Creating message bubble:', {
        id: langchainMessage.id,
        text: langchainMessage.text.substring(0, 100) + '...',
        textLength: langchainMessage.text.length,
        hasProducts: (langchainMessage.products?.length || 0) > 0,
        hasCart: !!langchainMessage.cartData,
        hasOrders: !!langchainMessage.orderData,
        hasPayment: !!langchainMessage.payment
      });

      // ✅ CRITICAL: Verify text before adding to state
      if (!langchainMessage.text || langchainMessage.text.trim() === '') {
        console.error('[Chat] ❌ CRITICAL ERROR: Message text is empty!');
        console.error('[Chat] 📦 Message object:', langchainMessage);
      } else {
        console.log('[Chat] ✅ Text verified, adding to messages');
      }

      // Add message to state
      set(state => {
        const newMessages = [...state.messages, langchainMessage];
        console.log('[Chat] 📊 Total messages now:', newMessages.length);
        console.log('[Chat] 📝 Last message text preview:', 
          newMessages[newMessages.length - 1].text.substring(0, 50));
        
        return {
          messages: newMessages,
          isLoading: false,
          aiThinking: false
        };
      });
    });

    socket.on('connect', () => {
      console.log('[Chat] ✅ Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[Chat] ❌ Socket disconnected');
    });
  },

  sendMessage: async (text: string, customerId: string) => {
    const { langchainEnabled } = get();
    console.log('[Chat] 📤 sendMessage called:', { 
      text: text.substring(0, 50), 
      customerId, 
      langchainEnabled 
    });
  
    if (!socket.connected) {
      console.error('[Chat] ❌ Socket not connected!');
      set({ error: 'Not connected to server. Please refresh the page.' });
      return;
    }
  
    console.log('[Chat] ✅ Socket connected:', socket.id);
    
    const isJSON = text.trim().startsWith('{') && text.trim().endsWith('}');
    
    if (!isJSON) {
      // Add user message to chat
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        text,
        sender: 'user',
        timestamp: new Date().toISOString(),
      };

      console.log('[Chat] 👤 Adding user message to UI');
      set(state => ({
        messages: [...state.messages, userMessage],
        isLoading: true,
        aiThinking: true,
        error: null
      }));
    } else {
      console.log('[Chat] 📦 Sending JSON data (checkout/payment)');
      set(state => ({
        isLoading: true,
        aiThinking: true,
        error: null
      }));
    }

    // Send to backend
    if (langchainEnabled && !isJSON) {
      console.log('[Chat] 🤖 Sending via LangChain');
      socket.emit('langchain-chat', {
        customerId,
        message: text
      });
    } else {
      console.log('[Chat] 💬 Sending via regular chat');
      socket.emit('chat-message', {
        customerId,
        message: text,
        sessionId: socket.id
      });
    }
  },

  clearMessages: () => set({ messages: [], error: null })
}));