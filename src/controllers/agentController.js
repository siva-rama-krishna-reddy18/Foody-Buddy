// src/controllers/agentController.js
const agentService = require('../services/agentService');
const Cart = require('../../models/Cart');
const CartItem = require('../../models/CartItem');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('[Socket] New client connected:', socket.id);

    // ✅ Debug - log ALL incoming events
    socket.onAny((eventName, ...args) => {
      console.log('[Socket] 📥 Received event:', eventName, 'with data:', args[0]);
    });

    // ✅ FIXED: LangChain Chat Handler
    socket.on('langchain-chat', async (data) => {
      try {
        const { customerId, message } = data;
        
        console.log('[Socket] 🤖 LangChain chat:', { customerId, message: message.substring(0, 50) });

        if (!customerId || !message) {
          socket.emit('langchain-response', {
            text: 'Missing required fields',
            error: true,
            timestamp: new Date().toISOString()
          });
          return;
        }

        // ✅ Set current customer
    agentService.langchainAgent.setCurrentCustomer(customerId);

        // ✅ ADD THIS CHECK - Handle payment success BEFORE LangChain
if (message.includes('PAYMENT SUCCESSFUL')) {
  console.log('[Socket] 💳 Detected PAYMENT SUCCESS - Processing order creation');
  
  // ✅ Use agentService to process payment success
  const response = await agentService.processMessage(customerId, message);
  
  console.log('[Socket] 💳 Payment success response:', {
    intent: response.intent,
    hasOrderData: !!response.orderData,
    aiText: response.aiText?.substring(0, 100)
  });
  
  // ✅ Send response with order data
  socket.emit('langchain-response', {
    text: response.aiText || '',
    toolsUsed: [],
    toolResults: [],
    products: [],
    cartData: null,
    orderData: response.orderData || null,
    clearCart: true,  // ✅ Signal to clear cart
    metadata: {
      suggestions: response.meta?.suggestions || ['View all orders', 'Place new order']
    },
    timestamp: new Date().toISOString()
  });
  
  return;  // ✅ IMPORTANT: Return here to prevent going to LangChain
}

        // ✅ CHECK FOR CHECKOUT (handle directly, don't use LangChain)
const lower = message.toLowerCase();
if (lower.includes('checkout') || lower.includes('proceed to pay')) {
  console.log('[Socket] 💳 Detected CHECKOUT request');
  
  const cart = await agentService.getCart(customerId);
  
  // ✅ Calculate tax
  const TAX_RATE = 0.08; // 8% tax
  const subtotal = cart.total;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  
  // ✅ Get applied coupon (if any)
  const coupon = agentService.langchainAgent?.getAppliedCoupon?.(customerId);
  let discount = 0;
  
  if (coupon) {
    if (coupon.type === 'percentage') {
      discount = (subtotal * coupon.discount) / 100;
    } else {
      discount = coupon.discount;
    }
  }
  
  const finalTotal = total - discount;
  
  console.log('[Socket] 💰 Checkout calculation:', {
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    discount: discount.toFixed(2),
    total: finalTotal.toFixed(2)
  });
  
  socket.emit('langchain-response', {
    text: '',
    toolsUsed: ['checkout'],
    toolResults: [],
    products: [],
    cartData: null,
    orderData: null,
    paymentData: {  // ✅ Changed from checkoutData to paymentData
      type: 'payment',
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      taxRate: TAX_RATE,
      discount: parseFloat(discount.toFixed(2)),
      total: parseFloat(finalTotal.toFixed(2)),
      coupon: coupon || null,
      items: cart.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }))
    },
    metadata: {
      suggestions: ['Complete payment', 'Go back to cart']
    },
    timestamp: new Date().toISOString()
  });
  return;
}

        //  Get LangChain response
const langchainResponse = await agentService.langchainAgent.chat(customerId, message);

console.log('[Socket] 🤖 LangChain response:', {
  text: langchainResponse.text.substring(0, 100),
  toolsUsed: langchainResponse.toolsUsed,
  toolResults: langchainResponse.toolResults
});

// ✅ Initialize response
let products = [];
let cartData = null;
let orderData = null;
let paymentData = null;  // ✅ ADD THIS LINE
let displayText = langchainResponse.text;

// ✅ NEW: Check for validation errors
const validationError = langchainResponse.toolResults?.find(r => r.validationFailed);
if (validationError) {
  console.log('[Socket] ❌ Validation error:', validationError.errors);
  
  socket.emit('langchain-response', {
    text: validationError.message || validationError.errors.join(' '),
    toolsUsed: langchainResponse.toolsUsed || [],
    toolResults: langchainResponse.toolResults || [],
    products: [],
    cartData: null,
    orderData: null,
    paymentData: null,
    metadata: {
      suggestions: validationError.suggestions || ['View menu', 'Add more items']
    },
    timestamp: new Date().toISOString()
  });
  return;
}

// ✅ ADD THIS SECTION - Check for payment UI trigger
const checkoutResult = langchainResponse.toolResults?.find(r => r.showPaymentUI);
if (checkoutResult?.payment) {
  console.log('[Socket] 💳 Payment UI triggered with email:', checkoutResult.customerEmail);
  paymentData = checkoutResult.payment;
  displayText = ''; // No AI text when showing payment

  // ✅ CRITICAL FIX: Merge any stored special instructions
  // Check if there are special instructions from a previous cart interaction
  const storedPayment = await agentService.getPaymentData(customerId);
  if (storedPayment?.specialInstructions) {
    console.log('[Socket] 📝 Found stored special instructions:', storedPayment.specialInstructions);
    paymentData.specialInstructions = {
      ...paymentData.specialInstructions,
      ...storedPayment.specialInstructions
    };
  }
  
  // ✅ ADD THESE LINES HERE - Store payment data
  await agentService.storePaymentData(customerId, paymentData);
  console.log('[Socket] 💾 Stored payment data:', {
    email: paymentData.email,
    subtotal: paymentData.subtotal,
    discount: paymentData.discount,
    tax: paymentData.tax,
    total: paymentData.total,
    coupon: paymentData.coupon?.code || 'None'
  });
}

// ✅ ADD THIS SECTION - Check if email needed
const needsEmailResult = langchainResponse.toolResults?.find(r => r.needsEmail);
if (needsEmailResult) {
  console.log('[Socket] 📧 Email required for checkout');
  displayText = needsEmailResult.message;
  
  socket.emit('langchain-response', {
    text: displayText,
    toolsUsed: langchainResponse.toolsUsed || [],
    toolResults: langchainResponse.toolResults || [],
    products: [],
    cartData: null,
    orderData: null,
    paymentData: null,
    metadata: {
      suggestions: ['Provide email', 'View cart']
    },
    timestamp: new Date().toISOString()
  });
  return;
}

// ✅ PRIORITY 1: Check for coupon first
const couponResult = langchainResponse.toolResults?.find(r => r.coupon);
if (couponResult && couponResult.coupon) {
  console.log('[Socket] 🎟️ Coupon applied:', couponResult.coupon);
  
  // ✅ EMIT EVENT TO FRONTEND
  socket.emit('coupon-applied', couponResult.coupon);
  console.log('[Socket] ✅ Emitted coupon-applied event to frontend');
  
  // Build cart data with discount
  cartData = {
    text: '',
    type: 'cart_display',
    cartItems: couponResult.cart?.items || couponResult.items || [],
    cartTotal: parseFloat(couponResult.cart?.total || couponResult.finalTotal || 0),
    subtotal: parseFloat(couponResult.cart?.subtotal || couponResult.subtotal || couponResult.finalTotal || 0),
    discount: parseFloat(couponResult.cart?.discount || couponResult.discountAmount || 0),
    coupon: couponResult.coupon || null,
    specialInstructions: couponResult.specialInstructions || []
  };
  
  displayText = '';
  console.log('[Socket] 🎟️ Displaying discounted cart');
}

// ✅ PRIORITY 2: Check for cart (add/view/remove)
if (!cartData) {
  const cartResult = langchainResponse.toolResults?.find(r => 
    r.cart || r.action === 'view' || r.action === 'add'
  );
  
  if (cartResult && cartResult.cart) {
    console.log('[Socket] 🛒 Cart result found');
    
    cartData = {
      type: 'cart_display',
      cartItems: cartResult.cart.items || [],
      cartTotal: cartResult.cart.total || 0,
      subtotal: cartResult.cart.subtotal || cartResult.cart.total || 0,
      discount: cartResult.cart.discount || 0
    };
    displayText = ''; // ✅ No AI text when showing cart
  }
}

// ✅ PRIORITY 3: Check for orders
const orderResult = langchainResponse.toolResults?.find(r => r.orders || r.order);

if (orderResult) {
  const aiConfirmation =
    langchainResponse.text?.includes('Payment successful') ||
    langchainResponse.text?.includes('Order confirmed')
      ? langchainResponse.text
      : '';
  
  // Single order details
  if (orderResult.order) {
    orderData = {
      type: 'order_tracking',
      orders: [{
        id: orderResult.order.orderNumber,
        orderNumber: orderResult.order.orderNumber,
        status: orderResult.order.status,
        date: new Date(orderResult.order.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        total: parseFloat(orderResult.order.total),
        discount: orderResult.order.discount,
        couponCode: orderResult.order.couponCode,
        originalAmount: orderResult.order.originalAmount,
        items: orderResult.order.items || [],
        specialInstructions: orderResult.order.specialInstructions || {},
        estimatedDelivery: orderResult.order.status === 'preparing' ?
          new Date(Date.now() + 45 * 60000).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : null
      }]
    };
    displayText = aiConfirmation;
    console.log('[Socket] 📦 Single order details prepared');
  }
  // Multiple orders list
  else if (orderResult.orders) {
    orderData = {
      type: 'order_tracking',
      orders: orderResult.orders.map(o => ({
        id: o.orderNumber,
        orderNumber: o.orderNumber,
        status: o.status,
        date: new Date(o.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        total: parseFloat(o.total),
        discount: o.discount,
        couponCode: o.couponCode,
        originalAmount: o.originalAmount,
        items: o.items || [], 
        specialInstructions: o.specialInstructions || {},
        estimatedDelivery: o.status === 'preparing' ?
          new Date(Date.now() + 45 * 60000).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : null
      }))
    };
    displayText = '';
    console.log('[Socket] 📦 Order list prepared:', orderData.orders.length, 'orders');
  }
}

// ✅ PRIORITY 4: Only show products if NO cart, NO orders, NO payment
if (!cartData && !orderData && !paymentData) {
  const menuResult = langchainResponse.toolResults?.find(r => r.items);
  if (menuResult && menuResult.items && menuResult.items.length > 0) {
    products = menuResult.items;
    displayText = '';
    console.log('[Socket] 🍽️ Products prepared:', products.length);
  }
} else {
  console.log('[Socket] ℹ️ Skipping products (cart, orders, or payment present)');
}

// ✅ Build response
const response = {
  text: displayText,
  toolsUsed: langchainResponse.toolsUsed || [],
  toolResults: langchainResponse.toolResults || [],
  products: products,
  cartData: cartData,
  orderData: orderData,
  paymentData: paymentData,  // ✅ ADD THIS
  metadata: {
    ...langchainResponse.metadata,
    suggestions: paymentData 
      ? []
      : cartData 
      ? ['Continue shopping', 'Proceed to checkout']
      : orderData
      ? ['View Menu', 'Place new order']
      : products.length > 0 
      ? ['Add to cart', 'View cart'] 
      : ['View Menu', 'Show my cart']
  },
  timestamp: new Date().toISOString()
};

// ✅ Apply normalization (existing code)
const normalizeLangchainResponse = (data) => {
  const hasManualPayment = data.toolResults?.some(r => r.manualPaymentSuccess) || data.manualPaymentSuccess;
  const hasClearCart = data.toolResults?.some(r => r.clearCart) || data.clearCart;

  if (hasManualPayment || hasClearCart) {
    console.log('[Socket] 🧹 Removing products after successful payment/order');

    const paymentText = data.text && data.text.trim() !== ''
      ? data.text
      : '✅ Order processed successfully. Payment link sent to your email.';

    return {
      ...data,
      products: [],
      text: paymentText,
      cartData: null,
      orderData: data.orderData || null,
      clearCart: true,
    };
  }

  return data;
};

// ✅ Apply normalization
const normalizedResponse = normalizeLangchainResponse(response);

console.log('[Socket] 📤 Sending response:', {
  hasText: !!normalizedResponse.text,
  hasProducts: normalizedResponse.products.length,
  hasCart: !!normalizedResponse.cartData,
  hasOrders: !!normalizedResponse.orderData,
  hasPayment: !!normalizedResponse.paymentData  // ✅ ADD THIS
});

// ✅ SEND THE RESPONSE
socket.emit('langchain-response', normalizedResponse);


      } catch (error) {
        console.error('[Socket] 🤖 LangChain error:', error);
        socket.emit('langchain-response', {
          text: "I'm having trouble processing that. Please try again.",
          error: true,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // ✅ Clear LangChain session handler
    socket.on('clear-langchain-session', async (data) => {
      try {
        const { customerId } = data;
        console.log('[Socket] Clearing LangChain session for:', customerId);
        
        agentService.langchainAgent.clearSession(customerId);
        
        socket.emit('session-cleared', {
          success: true,
          customerId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[Socket] Clear session error:', error);
      }
    });

    // Handle regular chat messages
    socket.on('chat-message', async (data) => {
      try {
        const { customerId, message, sessionId } = data;
        
        console.log('[Socket] 📨 Chat message received:', {
          customerId,
          message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
          messageLength: message.length,
          sessionId
        });

        if (!customerId || !message) {
          console.error('[Socket] Missing required fields:', { customerId: !!customerId, message: !!message });
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }

        // ✅ Log if it's a JSON message
        if (message.trim().startsWith('{')) {
          console.log('[Socket] 🔍 Detected JSON message, first 200 chars:', message.substring(0, 200));
        }

        // Process message through agent
        const response = await agentService.processMessage(customerId, message, sessionId);
        
        console.log('[Socket] ✅ Sending response with intent:', response.intent);
        console.log('[Socket] 📤 Has products:', response.hasProducts);
        console.log('[Socket] 📤 Has cart:', response.hasCart);
        console.log('[Socket] 📤 Has payment:', !!response.payment);
        
        // ✅ Emit as 'bot-message' to match frontend listener
        socket.emit('bot-message', {
          text: response.aiText || '',
          intent: response.intent,
          products: response.productList || [],
          cart: response.cartData || null,
          payment: response.payment || null,
          orderData: response.orderData || null,
          addToCart: response.addToCart || null,
          suggestions: response.meta?.suggestions || [],
          timestamp: response.meta?.timestamp || new Date().toISOString()
        });
        
        console.log('[Socket] ✅ bot-message emitted successfully');

      } catch (error) {
        console.error('[Socket] Error processing message:', error);
        socket.emit('bot-message', {
          text: "I'm having trouble processing that. Please try again.",
          intent: 'ERROR',
          products: [],
          cart: null,
          payment: null,
          orderData: null,
          suggestions: ['Try again'],
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle cart quantity updates
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

    // Find cart item - ✅ FIXED: Use product_id instead of productId
    const item = await CartItem.findOne({ 
      cart_id: cart.id, 
      product_id: productId  // ✅ Changed from productId to product_id
    });
    
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
      console.log('[Socket] ✅ Increased quantity to:', item.quantity);
    } else if (action === 'decrease') {
      // ✅ CRITICAL: If quantity is 1 and decreasing, remove the item entirely
      if (item.quantity === 1) {
        await CartItem.deleteOne({ _id: item._id });
        console.log('[Socket] ✅ Removed item (quantity was 1)');
      } else {
        item.quantity -= 1;
        item.updated_at = new Date();
        await item.save();
        console.log('[Socket] ✅ Decreased quantity to:', item.quantity);
      }
    }
    
    // Only save if item wasn't deleted
    if (action === 'increase' || item.quantity > 1) {
      item.updated_at = new Date();
      await item.save();
    }

    // Get updated cart and send response
    const response = await agentService.processMessage(customerId, 'show my cart');
    
    console.log('[Socket] Sending updated cart...');
    socket.emit('bot-message', {
      text: '',
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

        // Handle remove from cart
socket.on('remove-from-cart', async (data) => {
  try {
    console.log('[Socket] 📥 Received remove-from-cart:', data);
    
    const { customerId, productId } = data;
    
    if (!customerId || !productId) {
      console.error('[Socket] Missing required fields:', { customerId, productId });
      return;
    }

    console.log('[Socket] Remove from cart:', { customerId, productId });

    // ✅ UPDATED: Remove entire item (pass null for quantity)
    await agentService.removeItemFromCart(customerId, productId, null);
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