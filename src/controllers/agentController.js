// src/controllers/agentController.js
const agentService = require('../services/agentService');
const Cart = require('../../models/Cart');      // ✅ FIX: Add ../
const CartItem = require('../../models/CartItem'); // ✅ FIX: Add ../

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('[Socket] New client connected:', socket.id);

    // Handle chat messages
    socket.on('chat-message', async (data) => {
      try {
        const { customerId, message } = data;

        console.log(`[Socket] Message from ${customerId}: ${message}`);

        // Process message through agent
        const response = await agentService.processMessage(customerId, message);

        console.log('[Socket] Sending response:', {
          intent: response.intent,
          hasProducts: response.productList?.length > 0,
          hasCart: !!response.cartData,
          cartItemCount: response.cartData?.cartItems?.length
        });

        // Emit response to client
        socket.emit('bot-message', {
          text: response.aiText,
          intent: response.intent,
          products: response.productList || [],
          cart: response.cartData || null,
          addToCart: response.addToCart || null,
          orderData: response.orderData || null,
          payment: response.payment || null,
          suggestions: response.meta?.suggestions || [],
          timestamp: response.meta?.timestamp || new Date().toISOString()
        });

      } catch (error) {
        console.error('[Socket] Error handling message:', error);
        socket.emit('bot-message', {
          text: "I'm having trouble processing your request. Please try again.",
          intent: 'ERROR',
          products: [],
          cart: null,
          suggestions: ['Try again', 'View Menu'],
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle cart quantity updates
    // Update cart quantity updates
socket.on('update-cart-quantity', async (data) => {
  try {
    console.log('[Socket] 📥 Received update-cart-quantity:', data);
    
    const { customerId, productId, action } = data;
    
    if (!customerId || !productId || !action) {
      console.error('[Socket] Missing required fields:', { customerId, productId, action });
      return;
    }

    console.log('[Socket] Update cart quantity:', { customerId, productId, action });

    // Get current cart
    const cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      console.error('[Socket] Cart not found for customer:', customerId);
      socket.emit('bot-message', {
        text: 'Cart not found',
        intent: 'ERROR',
        cart: null,
        suggestions: ['View Menu'],
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log('[Socket] Found cart:', cart.id);

    // Find and update cart item
    const item = await CartItem.findOne({ cart_id: cart.id, productId });
    
    if (!item) {
      console.error('[Socket] Cart item not found:', productId);
      socket.emit('bot-message', {
        text: 'Item not found in cart',
        intent: 'ERROR',
        cart: null,
        suggestions: ['View cart'],
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log('[Socket] Found item:', { id: item.id, currentQuantity: item.quantity });
    
    if (action === 'increase') {
      item.quantity += 1;
    } else if (action === 'decrease') {
      item.quantity = Math.max(1, item.quantity - 1);
    }
    item.updated_at = new Date();
    await item.save();
    
    console.log('[Socket] ✅ Updated item quantity to:', item.quantity);

    // Get updated cart and send response
    const response = await agentService.processMessage(customerId, 'show my cart');
    
    console.log('[Socket] Sending updated cart...');
    socket.emit('bot-message', {
      text: '', // No text, just cart
      intent: response.intent,
      products: response.productList || [],
      cart: response.cartData || null,
      suggestions: response.meta?.suggestions || [],
      timestamp: response.meta?.timestamp || new Date().toISOString()
    });

  } catch (error) {
    console.error('[Socket] ❌ Update quantity error:', error);
    socket.emit('bot-message', {
      text: 'Error updating cart',
      intent: 'ERROR',
      cart: null,
      suggestions: ['Try again'],
      timestamp: new Date().toISOString()
    });
  }
});

// Update remove from cart
socket.on('remove-from-cart', async (data) => {
  try {
    console.log('[Socket] 📥 Received remove-from-cart:', data);
    
    const { customerId, productId } = data;
    
    if (!customerId || !productId) {
      console.error('[Socket] Missing required fields:', { customerId, productId });
      return;
    }

    console.log('[Socket] Remove from cart:', { customerId, productId });

    // Remove item
    await agentService.removeItemFromCart(customerId, productId);
    console.log('[Socket] ✅ Item removed');

    // Get updated cart and send response
    const response = await agentService.processMessage(customerId, 'show my cart');
    
    console.log('[Socket] Sending updated cart...');
    socket.emit('bot-message', {
      text: response.aiText || '',
      intent: response.intent,
      products: response.productList || [],
      cart: response.cartData || null,
      suggestions: response.meta?.suggestions || [],
      timestamp: response.meta?.timestamp || new Date().toISOString()
    });

  } catch (error) {
    console.error('[Socket] ❌ Remove from cart error:', error);
    socket.emit('bot-message', {
      text: 'Error removing item',
      intent: 'ERROR',
      cart: null,
      suggestions: ['Try again'],
      timestamp: new Date().toISOString()
    });
  }
});

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('[Socket] Client disconnected:', socket.id);
    });
  });
}

module.exports = {
  setupSocketHandlers
};