// src/controllers/agentController.js
const agentService = require('../services/agentService');
const Cart = require('../../models/Cart');
const CartItem = require('../../models/CartItem');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('[Socket] New client connected:', socket.id);

    socket.onAny((eventName, ...args) => {
      console.log('[Socket] 📥 Received event:', eventName, 'with data:', args[0]);
    });

    socket.on('langchain-chat', async (data) => {
      try {
        const { customerId, message } = data;
        
        console.log('[Socket] 🤖 LangChain chat:', { customerId, message: message });

        if (!customerId || !message) {
          socket.emit('langchain-response', {
            text: 'Missing required fields',
            error: true,
            timestamp: new Date().toISOString()
          });
          return;
        }

        agentService.langchainAgent.setCurrentCustomer(customerId);

        // ✅ HANDLE PAYMENT SUCCESS
        if (message.includes('PAYMENT SUCCESSFUL')) {
          console.log('[Socket] 💳 Detected PAYMENT SUCCESS - Processing order creation');
          
          const response = await agentService.processMessage(customerId, message);
          
          console.log('[Socket] 💳 Payment success response:', {
            intent: response.intent,
            hasOrderData: !!response.orderData,
            aiText: response.aiText?.substring(0, 100)
          });
          
          socket.emit('langchain-response', {
            text: response.aiText || '🎉 Order placed successfully! You\'ll receive a confirmation email shortly.',
            toolsUsed: [],
            toolResults: [],
            products: [],
            cartData: null,
            orderData: response.orderData || null,
            clearCart: true,
            metadata: {
              suggestions: ['View my orders', 'Place new order', 'View menu']
            },
            timestamp: new Date().toISOString()
          });
          
          return;
        }

        // ✅ GET LANGCHAIN RESPONSE (with conversation)
        const langchainResponse = await agentService.langchainAgent.chat(customerId, message);

        console.log('[Socket] 🤖 LangChain response:', {
          text: langchainResponse.text,
          toolsUsed: langchainResponse.toolsUsed,
          hasResults: langchainResponse.toolResults?.length > 0
        });

        // ✅ Initialize response
        let products = [];
        let cartData = null;
        let orderData = null;
        let paymentData = null;
        let displayText = langchainResponse.text;

        // ✅ CHECK FOR VALIDATION ERRORS
        const validationError = langchainResponse.toolResults?.find(r => r.validationFailed);
        if (validationError) {
          console.log('[Socket] ❌ Validation error:', validationError.errors);
          
          socket.emit('langchain-response', {
            text: displayText, // Use AI's response
            toolsUsed: langchainResponse.toolsUsed || [],
            toolResults: langchainResponse.toolResults || [],
            products: [],
            cartData: null,
            orderData: null,
            paymentData: null,
            metadata: {
              suggestions: ['View menu', 'Add more items']
            },
            timestamp: new Date().toISOString()
          });
          return;
        }

        // ✅ CHECK FOR PAYMENT UI
        const checkoutResult = langchainResponse.toolResults?.find(r => r.showPaymentUI);
        if (checkoutResult?.payment) {
          console.log('[Socket] 💳 Payment UI triggered');
          paymentData = checkoutResult.payment;
          displayText = '✨ Great! Let\'s complete your order. Please review and confirm payment.';
          
          await agentService.storePaymentData(customerId, paymentData);
        }

        // ✅ CHECK FOR COUPON
        const couponResult = langchainResponse.toolResults?.find(r => r.coupon);
        if (couponResult && couponResult.coupon) {
          console.log('[Socket] 🎟️ Coupon applied:', couponResult.coupon);
          
          socket.emit('coupon-applied', couponResult.coupon);
          
          cartData = {
            type: 'cart_display',
            cartItems: couponResult.cart?.items || [],
            cartTotal: parseFloat(couponResult.cart?.total || 0),
            subtotal: parseFloat(couponResult.cart?.subtotal || 0),
            discount: parseFloat(couponResult.cart?.discount || 0),
            coupon: couponResult.coupon || null
          };
          
          // ✅ Keep AI text for coupon confirmation
          console.log('[Socket] 🎟️ Displaying discounted cart with AI text');
        }

        // ✅ CHECK FOR CART
        if (!cartData) {
          const cartResult = langchainResponse.toolResults?.find(r => 
            r.cart || r.action === 'view' || r.action === 'add' || r.action === 'remove'
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
            
            // ✅ Keep AI text when cart is shown
            // displayText stays as langchainResponse.text
    console.log('[Socket] 💬 Keeping AI text with cart:', displayText);
          }
        }

        // ✅ CHECK FOR ORDERS
        const orderResult = langchainResponse.toolResults?.find(r => r.orders || r.order);

        if (orderResult) {
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
                specialInstructions: orderResult.order.specialInstructions || {}
              }]
            };
            // ✅ Keep AI text for orders
          } else if (orderResult.orders) {
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
                items: o.items || []
              }))
            };
            // ✅ Keep AI text for order list
          }
        }

        // ✅ CHECK FOR PRODUCTS (only if no cart/orders/payment)
        if (!cartData && !orderData && !paymentData) {
          const menuResult = langchainResponse.toolResults?.find(r => r.items);
          if (menuResult && menuResult.items && menuResult.items.length > 0) {
            products = menuResult.items;
            // ✅ Keep AI text when showing products
            console.log('[Socket] 📦 Products prepared:', products.length);
          }
        }

        // ✅ SMART SUGGESTIONS BASED ON CONTEXT
        const suggestions = getSuggestions({
          hasProducts: products.length > 0,
          hasCart: !!cartData,
          hasOrders: !!orderData,
          hasPayment: !!paymentData,
          cartItems: cartData?.cartItems?.length || 0,
          lastTool: langchainResponse.toolsUsed?.[langchainResponse.toolsUsed.length - 1],
          lastResult: langchainResponse.toolResults?.[langchainResponse.toolResults.length - 1]
        });

        // ✅ BUILD RESPONSE
        const response = {
          text: displayText, // ✅ Always include AI text
          toolsUsed: langchainResponse.toolsUsed || [],
          toolResults: langchainResponse.toolResults || [],
          products: products,
          cartData: cartData,
          orderData: orderData,
          paymentData: paymentData,
          metadata: {
            ...langchainResponse.metadata,
            suggestions: suggestions
          },
          timestamp: new Date().toISOString()
        };

        console.log('[Socket] 📤 Sending response:', {
          hasText: !!response.text,
          textLength: response.text?.length || 0,
          hasProducts: products.length,
          hasCart: !!cartData,
          hasOrders: !!orderData,
          hasPayment: !!paymentData,
          suggestions: suggestions
        });

        socket.emit('langchain-response', response);

      } catch (error) {
        console.error('[Socket] ❌ LangChain error:', error);
        socket.emit('langchain-response', {
          text: "Oops! Something went wrong. Let's try that again? 😅",
          error: true,
          errorMessage: error.message,
          metadata: {
            suggestions: ['Try again', 'View menu', 'Show cart']
          },
          timestamp: new Date().toISOString()
        });
      }
    });

    // ... (keep all other socket handlers: clear-langchain-session, chat-message, update-cart-quantity, remove-from-cart, disconnect)
    
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

    socket.on('chat-message', async (data) => {
      try {
        const { customerId, message, sessionId } = data;
        
        console.log('[Socket] 📥 Chat message received:', {
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

        if (message.trim().startsWith('{')) {
          console.log('[Socket] 🔍 Detected JSON message, first 200 chars:', message);
        }

        const response = await agentService.processMessage(customerId, message, sessionId);
        
        console.log('[Socket] 📤 Sending response with intent:', response.intent);
        
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

    socket.on('update-cart-quantity', async (data) => {
      try {
        console.log('[Socket] 📥 Received update-cart-quantity:', data);
        
        const { customerId, productId, action } = data;
        
        if (!customerId || !productId || !action) {
          console.error('[Socket] Missing required fields:', { customerId, productId, action });
          return;
        }

        const cart = await Cart.findOne({ customer_id: customerId });
        if (!cart) {
          console.error('[Socket] Cart not found for customer:', customerId);
          return;
        }

        const item = await CartItem.findOne({ 
          cart_id: cart.id, 
          productId: productId
        });
        
        if (!item) {
          console.error('[Socket] Cart item not found:', productId);
          return;
        }
        
        if (action === 'increase') {
          item.quantity += 1;
          item.updated_at = new Date();
          await item.save();
        } else if (action === 'decrease') {
          if (item.quantity === 1) {
            await CartItem.deleteOne({ _id: item._id });
          } else {
            item.quantity -= 1;
            item.updated_at = new Date();
            await item.save();
          }
        }

        const response = await agentService.processMessage(customerId, 'show my cart');
        
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
      }
    });

    socket.on('remove-from-cart', async (data) => {
      try {
        console.log('[Socket] 📥 Received remove-from-cart:', data);
        
        const { customerId, productId } = data;
        
        if (!customerId || !productId) {
          console.error('[Socket] Missing required fields:', { customerId, productId });
          return;
        }

        await agentService.removeItemFromCart(customerId, productId, null);

        const response = await agentService.processMessage(customerId, 'show my cart');
        
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
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Client disconnected:', socket.id);
    });
  });
}

// ✅ SMART SUGGESTIONS FUNCTION
function getSuggestions(context) {
  const {
    hasProducts,
    hasCart,
    hasOrders,
    hasPayment,
    cartItems,
    lastTool,
    lastResult
  } = context;

  // Payment UI
  if (hasPayment) {
    return ['Complete payment'];
  }

  // After adding to cart
  if (lastTool === 'cart_operations' && lastResult?.action === 'add') {
    return ['Add more items', 'View cart', 'Apply coupon', 'Checkout'];
  }

  // After removing from cart
  if (lastTool === 'cart_operations' && lastResult?.action === 'remove') {
    if (cartItems > 0) {
      return ['Add more items', 'Checkout', 'View menu'];
    } else {
      return ['View menu', 'Show specials'];
    }
  }

  // Viewing cart
  if (hasCart) {
    if (cartItems > 0) {
      return ['Proceed to checkout', 'Add more items', 'Apply coupon'];
    } else {
      return ['View menu', 'Show popular items'];
    }
  }

  // After applying coupon
  if (lastTool === 'coupon_operations' && lastResult?.action === 'apply') {
    return ['Proceed to checkout', 'Add more items', 'View cart'];
  }

  // Viewing orders
  if (hasOrders) {
    return ['Place new order', 'View menu', 'Track another order'];
  }

  // Viewing products
  if (hasProducts) {
    return ['Add to cart', 'View cart', 'Show more options'];
  }

  // Default suggestions
  return ['View menu', 'Show cart', 'View my orders'];
}

module.exports = {
  setupSocketHandlers
};