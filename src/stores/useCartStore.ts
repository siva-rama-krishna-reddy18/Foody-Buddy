// src/stores/useCartStore.ts
import { create } from 'zustand';
import { api } from '../services/api/ApiClient';
import type { CartItem, CartData } from '../types/index';

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadCart: (customerId: string) => Promise<void>;
  addItem: (customerId: string, productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (customerId: string, productId: string, quantity: number) => Promise<void>;
  removeItem: (customerId: string, productId: string) => Promise<void>;
  clearCart: (customerId: string) => Promise<void>;
  updateFromChatData: (cartData: CartData | null) => void;
  getTotalPrice: () => number;
  getItemCount: () => number;
  clearError: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  total: 0,
  itemCount: 0,
  isLoading: false,
  error: null,

  loadCart: async (customerId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.cart.getCart(customerId);
      const cartData = response.data;
      
      set({
        items: cartData.items || [],
        total: parseFloat(cartData.totalAmount || '0'),
        itemCount: cartData.itemCount || 0,
        isLoading: false
      });
    } catch (error) {
      console.error('Load cart error:', error);
      set({ 
        isLoading: false, 
        error: 'Failed to load cart',
        items: [],
        total: 0,
        itemCount: 0
      });
    }
  },

  addItem: async (customerId: string, productId: string, quantity = 1) => {
    set({ isLoading: true, error: null });
    try {
      await api.cart.addToCart({ customerId, productId, quantity });
      // Reload cart to get updated state
      await get().loadCart(customerId);
    } catch (error) {
      console.error('Add to cart error:', error);
      set({ isLoading: false, error: 'Failed to add item to cart' });
    }
  },

  updateQuantity: async (customerId: string, productId: string, quantity: number) => {
    if (quantity <= 0) {
      await get().removeItem(customerId, productId);
      return;
    }

    set({ isLoading: true, error: null });
    try {
      await api.cart.updateCartItem({ customerId, productId, quantity });
      await get().loadCart(customerId);
    } catch (error) {
      console.error('Update quantity error:', error);
      set({ isLoading: false, error: 'Failed to update item quantity' });
    }
  },

  removeItem: async (customerId: string, productId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.cart.removeFromCart(customerId, productId);
      await get().loadCart(customerId);
    } catch (error) {
      console.error('Remove item error:', error);
      set({ isLoading: false, error: 'Failed to remove item from cart' });
    }
  },

  clearCart: async (customerId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.cart.clearCart(customerId);
      set({
        items: [],
        total: 0,
        itemCount: 0,
        isLoading: false
      });
    } catch (error) {
      console.error('Clear cart error:', error);
      set({ isLoading: false, error: 'Failed to clear cart' });
    }
  },

  updateFromChatData: (cartData: CartData | null) => {
    if (cartData) {
      set({
        items: cartData.items,
        total: cartData.total,
        itemCount: cartData.itemCount,
        error: null
      });
    }
  },

  getTotalPrice: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  getItemCount: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },

  clearError: () => {
    set({ error: null });
  }
}));