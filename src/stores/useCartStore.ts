// src/stores/useCartStore.ts
import { create } from 'zustand';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface Coupon {
  code: string;
  discount: number;
  description: string;
}

interface CartState {
  items: CartItem[];
  total: number;
  subtotal: number;
  discount: number;
  coupon: Coupon | null;
  specialInstructions: { [key: string]: string };
  itemCount: number;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadCart: (customerId: string) => Promise<void>;
  addItem: (customerId: string, productId: string, quantity: number) => Promise<void>;
  updateQuantity: (customerId: string, productId: string, quantity: number) => Promise<void>;
  removeItem: (customerId: string, productId: string) => Promise<void>;
  clearCart: (customerId: string) => Promise<void>;
  updateFromChatData: (cartData: any) => void;
  setSpecialInstructions: (instructions: { [key: string]: string }) => void;
  setError: (error: string | null) => void;
}

export const useCartStore = create<CartState>((set, get) => {
  return {
    items: [],
    total: 0,
    subtotal: 0,
    discount: 0,
    coupon: null,
    specialInstructions: {},
    itemCount: 0,
    isLoading: false,
    error: null,

    loadCart: async (customerId: string) => {
      console.log('🔄 Loading cart for:', customerId);
      set({ isLoading: true, error: null });
      try {
        setTimeout(() => set({ isLoading: false }), 500);
      } catch (error) {
        console.error('Load cart error:', error);
        set({ isLoading: false, error: 'Failed to load cart' });
      }
    },

    addItem: async (customerId: string, productId: string, quantity: number) => {
      console.log('➕ Adding item to cart:', { customerId, productId, quantity });
      set({ isLoading: true, error: null });
      try {
        set({ isLoading: false });
      } catch (error) {
        console.error('Add item error:', error);
        set({ isLoading: false, error: 'Failed to add item' });
      }
    },

    updateQuantity: async (customerId: string, productId: string, quantity: number) => {
      console.log('🔄 Updating quantity:', { customerId, productId, quantity });
      const { items, coupon } = get();
      const updatedItems = items.map(item => 
        item.productId === productId ? { ...item, quantity } : item
      );
      const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const newDiscount = coupon ? (newSubtotal * (coupon.discount / 100)) : 0;
      const newTotal = newSubtotal - newDiscount;
      const newItemCount = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
      set({
        items: updatedItems,
        subtotal: newSubtotal,
        discount: newDiscount,
        total: newTotal,
        itemCount: newItemCount
      });
    },

    removeItem: async (customerId: string, productId: string) => {
      console.log('🗑️ Removing item:', { customerId, productId });
      const { items, coupon, specialInstructions } = get();
      const updatedItems = items.filter(item => item.productId !== productId);
      
      if (updatedItems.length === 0) {
        console.log('🗑️ No items left, clearing cart');
        set({
          items: [],
          subtotal: 0,
          discount: 0,
          total: 0,
          itemCount: 0,
          coupon: null,
          specialInstructions: {}
        });
        return;
      }
      
      // Remove special instructions for removed item
      const newInstructions = { ...specialInstructions };
      delete newInstructions[productId];
      
      const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const newDiscount = coupon ? (newSubtotal * (coupon.discount / 100)) : 0;
      const newTotal = newSubtotal - newDiscount;
      const newItemCount = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
      
      set({
        items: updatedItems,
        subtotal: newSubtotal,
        discount: newDiscount,
        total: newTotal,
        itemCount: newItemCount,
        coupon: coupon,
        specialInstructions: newInstructions
      });
    },

    clearCart: async (customerId: string) => {
      console.log('🗑️ Clearing cart for:', customerId);
      set({ 
        items: [], 
        total: 0,
        subtotal: 0,
        discount: 0,
        coupon: null,
        specialInstructions: {},
        itemCount: 0,
        isLoading: false,
        error: null 
      });
    },

    setSpecialInstructions: (instructions: { [key: string]: string }) => {
      console.log('📝 Setting special instructions:', instructions);
      set({ specialInstructions: instructions });
    },

    updateFromChatData: (cartData: any) => {
      console.log('🔄 [CartStore] updateFromChatData called');
      console.log('🔄 [CartStore] Received cartData:', JSON.stringify(cartData, null, 2));
      
      if (!cartData) {
        console.log('⚠️ [CartStore] No cart data provided, clearing cart');
        set({
          items: [],
          total: 0,
          subtotal: 0,
          discount: 0,
          coupon: null,
          specialInstructions: {},
          itemCount: 0,
          error: null
        });
        return;
      }

      // ✅ Parse cart items
      const cartItems: CartItem[] = (cartData.cartItems || []).map((item: any) => {
        const parsed = {
          id: item.id || item.productId,
          productId: item.productId || item.id,
          name: item.title || item.name || 'Unknown Item',
          price: parseFloat(item.unit_price || item.price || 0),
          quantity: parseInt(item.quantity || 1),
          image: item.image || item.imageUrl || ''
        };
        console.log('📦 [CartStore] Parsed item:', parsed);
        return parsed;
      });

      // ✅ Parse coupon data
      let couponData = null;
      if (cartData.coupon) {
        couponData = {
          code: cartData.coupon.code || '',
          discount: parseFloat(cartData.coupon.discount || 0),
          description: cartData.coupon.description || ''
        };
        console.log('💳 [CartStore] Parsed coupon:', couponData);
      }

      // ✅ Get totals from backend
      const rawTotal = parseFloat(cartData.cartTotal || cartData.total || 0);
      const rawSubtotal = parseFloat(cartData.subtotal || rawTotal);
      const rawDiscount = parseFloat(cartData.discount || 0);
      const newItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

      console.log('💰 [CartStore] Calculated values:', {
        rawTotal,
        rawSubtotal,
        rawDiscount,
        newItemCount,
        itemsLength: cartItems.length
      });

      const currentState = get();
  const preservedInstructions = currentState.specialInstructions || {};
  
  console.log('📝 [CartStore] Preserving special instructions:', preservedInstructions);

      const newState = {
        items: cartItems,
        total: rawTotal,
        subtotal: rawSubtotal,
        discount: rawDiscount,
        coupon: couponData,
        specialInstructions: preservedInstructions,
        itemCount: newItemCount,
        error: null
      };

      console.log('✅ [CartStore] Setting new state:', newState);
      set(newState);
      
      // ✅ Verify state was set
      setTimeout(() => {
        const currentState = get();
        console.log('🔍 [CartStore] State after update:', {
          itemCount: currentState.itemCount,
          total: currentState.total,
          discount: currentState.discount,
          coupon: currentState.coupon,
          specialInstructions: currentState.specialInstructions
        });
      }, 100);
    },

    setError: (error: string | null) => {
      set({ error });
    }
  };
});