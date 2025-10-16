// src/services/agentService.js
const { generateAIResponse, testOllamaConnection } = require('./aiResponseService');
const { classifyIntent, extractEntities } = require('./intentService');
const { searchSimilar } = require('./vectorService');
const Cart = require('../../models/Cart');
const CartItem = require('../../models/CartItem');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const Customer = require('../../models/Customer');
const CustomerPreferences = require('../../models/CustomerPreferences');
const Coupon = require('../../models/Coupon');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const pendingPayments = new Map();

const DEBUG = process.env.DEBUG_ORCHESTRATOR === 'true';
const USE_AI = process.env.USE_AI_RESPONSES !== 'false';

class AgentService {
  constructor() {
    // Test Ollama on startup
    testOllamaConnection();
  }
  async processMessage(customerId, message, sessionId = null) {
  try {
    console.log('[Agent] Processing:', `"${message}"`, 'for customer:', customerId);

    // Classify intent
    const intent = await classifyIntent(message);
    console.log('[Agent] Intent:', intent);

    let response;

    // Route to appropriate handler
    switch (intent) {
      case 'GREETING':
        response = await this.handleGreeting(customerId, message);
        break;

      case 'RECOMMEND':
        response = await this.handleMenuOrSpecials(customerId, message);
        break;

      case 'SEARCH':
        response = await this.handleSearch(customerId, message);
        break;

      case 'ADD_TO_CART':
        const entities = await extractEntities(message);
        response = await this.handleAddToCart(customerId, message, entities);
        break;

      case 'VIEW_CART':
        response = await this.handleViewCart(customerId);
        break;

      case 'DECREASE_QUANTITY':
  response = await this.handleDecreaseQuantity(customerId, message);
  break;

      case 'REMOVE_FROM_CART':
        const removeEntities = await extractEntities(message);
        response = await this.handleRemoveFromCart(customerId, message, removeEntities);
        break;

      case 'CLEAR_CART':
        response = await this.handleClearCart(customerId);
        break;

      case 'APPLY_COUPON':
  const applyCouponEntities = await extractEntities(message);
  response = await this.handleApplyCoupon(customerId, message, applyCouponEntities);
  break;

case 'REMOVE_COUPON':
  response = await this.handleRemoveCoupon(customerId);
  break;

      case 'CHECKOUT':
        response = await this.handleCheckout(customerId, message); // ✅ Pass message here
        break;

      case 'PAYMENT_SUCCESS':
        response = await this.handlePaymentSuccess(customerId, message);
        break;

      case 'ORDER_STATUS':
        response = await this.handleOrderStatus(customerId);
        break;

      case 'TRACK_ORDER':
        const trackEntities = await extractEntities(message);
        response = await this.handleTrackOrder(customerId, message, trackEntities);
        break;

      case 'REORDER':
        const reorderEntities = await extractEntities(message);
        response = await this.handleReorder(customerId, message, reorderEntities);
        break;

      case 'LEARN_PREFERENCE':
        response = await this.handleLearnPreference(customerId, message);
        break;

      case 'UNKNOWN':
      default:
        const aiText = await generateAIResponse('UNKNOWN', {}, message);
        response = {
          aiText,
          intent: 'UNKNOWN',
          productList: [],
          addToCart: null,
          cartData: null,
          meta: {
            suggestions: ['View Menu', 'Show my cart', 'Track orders'],
            timestamp: new Date().toISOString()
          }
        };
    }

    // Return standardized response
    return {
      aiText: response.aiText || '',
      intent: response.intent || intent,
      productList: response.productList || [],
      addToCart: response.addToCart || null,
      cartData: response.cartData || null,
      payment: response.payment || null,
      orderData: response.orderData || null,
      hasProducts: response.productList && response.productList.length > 0,
      hasCart: !!response.cartData,
      cartItemCount: response.cartData?.cartItems?.length,
      meta: response.meta || {
        suggestions: [],
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('[Agent] Error processing message:', error);
    return {
      aiText: "Sorry, I encountered an error processing your request. Please try again.",
      intent: 'ERROR',
      productList: [],
      addToCart: null,
      cartData: null,
      payment: null,
      orderData: null,
      hasProducts: false,
      hasCart: false,
      meta: {
        suggestions: ['Try again', 'View Menu'],
        timestamp: new Date().toISOString()
      }
    };
  }
  }
   async handleGreeting(customerId, message = '') {
    console.log('[Agent] Handling greeting, generating AI response...');
  const aiText = await generateAIResponse('GREETING', {}, message);
  console.log('[Agent] ✅ AI greeting generated:', aiText);
    return {
      aiText,
      intent: 'GREETING',
      productList: [],
      addToCart: null,
      cartData: null,
      meta: {
        suggestions: ['View Menu', 'Track Orders', "Today's Specials"],
        timestamp: new Date().toISOString()
      }
    };
  }

  async handleMenuOrSpecials(customerId, message) {
    const products = await searchSimilar(message, 50);
    if (products.length === 0) {
      return {
        aiText: "Sorry, no menu items available right now. Please check back later! 🍽️",
        intent: 'RECOMMEND',
        productList: [],
        addToCart: null,
        cartData: null,
        meta: { suggestions: ['Try again later'], timestamp: new Date().toISOString() }
      };
    }
    const lowerMessage = message.toLowerCase();
    const isSpecials = lowerMessage.includes('special');
    return {
      aiText:'',
      intent: 'RECOMMEND',
      productList: products.slice(0, 10),
      addToCart: null,
      cartData: null,
      meta: { suggestions: ['Add to cart', 'Show my cart', 'Search for items'], timestamp: new Date().toISOString() }
    };
  }

  async handleSearch(customerId, message) {
    const products = await searchSimilar(message, 5);
    if (products.length === 0) {
      return {
        aiText: `I couldn't find anything matching "${message}". Try browsing our full menu! 🔍`,
        intent: 'SEARCH',
        productList: [],
        addToCart: null,
        cartData: null,
        meta: { suggestions: ['View Menu', 'Try different search'], timestamp: new Date().toISOString() }
      };
    }
    return {
      aiText: '',
      intent: 'SEARCH',
      productList: products,
      addToCart: null,
      cartData: null,
      meta: { suggestions: ['Add to cart', 'View Menu', 'Show my cart'], timestamp: new Date().toISOString() }
    };
  }

  async handleAddToCart(customerId, message) {
    const products = await searchSimilar(message, 1);
    if (products.length === 0) {
      return {
        aiText: "I couldn't find that item. Can you try searching again? 🔍",
        intent: 'ADD_TO_CART',
        productList: [],
        addToCart: null,
        cartData: null,
        meta: { suggestions: ['View Menu', 'Search again'], timestamp: new Date().toISOString() }
      };
    }
    const product = products[0];
    console.log('[Agent] Adding product:', product.id, product.name);
    try {
      await this.addItemToCart(customerId, product.id, 1);
      const cart = await this.getCart(customerId);
      return {
        aiText: `✅ Added ${product.name} to your cart! ($${product.price})`,
        intent: 'ADD_TO_CART',
        productList: [],
        addToCart: { product, quantity: 1 },
        cartData: { text: '', type: 'cart_display', cartItems: cart.cartItems, cartTotal: cart.cartTotal },
        meta: { suggestions: ['Add more items', 'Proceed to pay'], timestamp: new Date().toISOString() }
      };
    } catch (error) {
      console.error('[Agent] Add to cart error:', error);
      return {
        aiText: "Sorry, couldn't add that item. Please try again.",
        intent: 'ADD_TO_CART',
        productList: [],
        addToCart: null,
        cartData: null,
        meta: { suggestions: ['Try again', 'View Menu'], timestamp: new Date().toISOString() }
      };
    }
  }

  async handleDecreaseQuantity(customerId, message) {
  const products = await searchSimilar(message, 1);
  if (products.length === 0) {
    return {
      aiText: "I couldn't find that item in your cart.",
      intent: 'DECREASE_QUANTITY',
      productList: [],
      addToCart: null,
      cartData: null,
      meta: { suggestions: ['View cart', 'View Menu'], timestamp: new Date().toISOString() }
    };
  }

  const product = products[0];
  console.log('[Agent] Decreasing quantity for product:', product.id, product.name);

  try {
    const cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      return {
        aiText: "Your cart is empty.",
        intent: 'DECREASE_QUANTITY',
        productList: [],
        addToCart: null,
        cartData: null,
        meta: { suggestions: ['View Menu'], timestamp: new Date().toISOString() }
      };
    }

    const cartItem = await CartItem.findOne({ 
      cart_id: cart.id, 
      productId: product.id 
    });

    if (!cartItem) {
      return {
        aiText: `${product.name} is not in your cart.`,
        intent: 'DECREASE_QUANTITY',
        productList: [],
        addToCart: null,
        cartData: null,
        meta: { suggestions: ['View cart', 'View Menu'], timestamp: new Date().toISOString() }
      };
    }

    if (cartItem.quantity <= 1) {
      // Remove item if quantity would be 0
      await CartItem.deleteOne({ _id: cartItem._id });
      const updatedCart = await this.getCart(customerId);
      
      return {
        aiText: `Removed ${product.name} from your cart.`,
        intent: 'DECREASE_QUANTITY',
        productList: [],
        addToCart: null,
        cartData: updatedCart.items.length > 0 ? {
          text: '',
          type: 'cart_display',
          cartItems: updatedCart.cartItems,
          cartTotal: updatedCart.cartTotal
        } : null,
        meta: { suggestions: ['Add more items', 'View Menu'], timestamp: new Date().toISOString() }
      };
    } else {
      // Decrease quantity
      cartItem.quantity -= 1;
      cartItem.updated_at = new Date();
      await cartItem.save();
      
      const updatedCart = await this.getCart(customerId);
      
      return {
        aiText: `Updated ${product.name} quantity to ${cartItem.quantity}.`,
        intent: 'DECREASE_QUANTITY',
        productList: [],
        addToCart: null,
        cartData: {
          text: '',
          type: 'cart_display',
          cartItems: updatedCart.cartItems,
          cartTotal: updatedCart.cartTotal
        },
        meta: { suggestions: ['Proceed to pay', 'Add more items'], timestamp: new Date().toISOString() }
      };
    }

  } catch (error) {
    console.error('[Agent] Decrease quantity error:', error);
    return {
      aiText: "Sorry, couldn't update the quantity. Please try again.",
      intent: 'DECREASE_QUANTITY',
      productList: [],
      addToCart: null,
      cartData: null,
      meta: { suggestions: ['Try again', 'View cart'], timestamp: new Date().toISOString() }
    };
  }
}

  async handleViewCart(customerId) {
    const cart = await this.getCart(customerId);
    console.log('[Agent] VIEW_CART - Cart data:', { hasItems: cart.items && cart.items.length > 0, itemCount: cart.itemCount, total: cart.total });
    if (!cart.items || cart.items.length === 0) {
      return {
        aiText: "Your cart is empty! 🛒 Browse our menu to add items.",
        intent: 'VIEW_CART',
        productList: [],
        addToCart: null,
        cartData: null,
        meta: { suggestions: ['View Menu', "Today's Specials"], timestamp: new Date().toISOString() }
      };
    }
    return {
      aiText: '',
      intent: 'VIEW_CART',
      productList: [],
      addToCart: null,
      cartData: { text: '', type: 'cart_display', cartItems: cart.cartItems, cartTotal: cart.cartTotal },
      meta: { suggestions: ['Add more items', 'Proceed to pay', 'Clear cart'], timestamp: new Date().toISOString() }
    };
  }

  async handleCheckout(customerId, message) {
    console.log('[Agent] 🛒 CHECKOUT - Raw message received:', message);
    console.log('[Agent] 🛒 Message type:', typeof message);
    
    if (!message) {
      console.error('[Agent] ❌ No message provided to handleCheckout');
      return {
        aiText: "Error processing checkout. Please try again.",
        intent: 'CHECKOUT',
        productList: [],
        addToCart: null,
        cartData: null,
        payment: null,
        meta: {
          suggestions: ['Show my cart', 'View Menu'],
          timestamp: new Date().toISOString()
        }
      };
    }
    
    console.log('[Agent] 🛒 Message length:', message.length);
    
    const cart = await this.getCart(customerId);

    if (!cart.items || cart.items.length === 0) {
      return {
        aiText: "Your cart is empty! Add some items first. 🛒",
        intent: 'CHECKOUT',
        productList: [],
        addToCart: null,
        cartData: null,
        payment: null,
        meta: {
          suggestions: ['View Menu'],
          timestamp: new Date().toISOString()
        }
      };
    }

    // Parse JSON checkout data
    let checkoutData = null;
    const trimmedMessage = message.trim();
    
    console.log('[Agent] 🔍 Trimmed message:', trimmedMessage);
    
    if (trimmedMessage.startsWith('{') && trimmedMessage.endsWith('}')) {
      try {
        checkoutData = JSON.parse(trimmedMessage);
        console.log('[Agent] ✅ Successfully parsed JSON checkout data:', JSON.stringify(checkoutData, null, 2));
      } catch (error) {
        console.error('[Agent] ❌ JSON parse error:', error.message);
      }
    }

    // Calculate total with coupon
    let subtotal = parseFloat(cart.total);
    let discount = 0;
    let total = subtotal;
    let appliedCoupon = null;
    let specialInstructions = {};

    if (checkoutData?.coupon) {
      appliedCoupon = checkoutData.coupon;
      discount = subtotal * (appliedCoupon.discount / 100);
      total = subtotal - discount;
      
      console.log('[Agent] 💰 Coupon applied:', {
        code: appliedCoupon.code,
        discountPercent: appliedCoupon.discount + '%',
        subtotal: '$' + subtotal.toFixed(2),
        discountAmount: '$' + discount.toFixed(2),
        finalTotal: '$' + total.toFixed(2)
      });
    }

    if (checkoutData?.specialInstructions) {
      specialInstructions = checkoutData.specialInstructions;
      console.log('[Agent] 📝 Special instructions:', specialInstructions);
    }

    const paymentData = {
      total: parseFloat(total.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discount.toFixed(2)),
      coupon: appliedCoupon,
      specialInstructions: specialInstructions,
      items: cart.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }))
    };

    // ✅ Store payment data for when payment completes
    pendingPayments.set(customerId, {
      paymentData,
      timestamp: Date.now()
    });
    console.log('[Agent] 💾 Stored payment data for customer:', customerId);

    console.log('[Agent] 💳 Final payment data being sent:', JSON.stringify(paymentData, null, 2));

    return {
      aiText: '',
      intent: 'CHECKOUT',
      productList: [],
      addToCart: null,
      cartData: null,
      payment: paymentData,
      meta: {
        suggestions: [],
        timestamp: new Date().toISOString()
      }
    };
  }

  async handlePaymentSuccess(customerId, message) {
    try {
      console.log('\n==================== PAYMENT SUCCESS START ====================');
      console.log('[Agent] Processing payment success for customer:', customerId);
      
      // ✅ Get stored payment data
      const storedPayment = pendingPayments.get(customerId);
      console.log('[Agent] 📦 Retrieved stored payment data:', storedPayment ? 'Found' : 'Not found');
      
      const cart = await this.getCart(customerId);
      
      console.log('[Agent] Cart contents:', {
        itemCount: cart.itemCount,
        total: cart.total,
        items: cart.items?.length || 0
      });
      
      if (!cart.items || cart.items.length === 0) {
        pendingPayments.delete(customerId); // Clean up
        console.log('[Agent] ❌ No items in cart');
        return {
          aiText: "No items in cart to complete order.",
          intent: 'PAYMENT_SUCCESS',
          productList: [],
          addToCart: null,
          cartData: null,
          orderData: null,
          meta: {
            suggestions: ['View Menu'],
            timestamp: new Date().toISOString()
          }
        };
      }

      // ✅ Calculate final amounts using stored payment data
      let finalAmount = parseFloat(cart.total);
      let discount = 0;
      let appliedCoupon = null;
      let specialInstructions = {};

      if (storedPayment?.paymentData) {
        const paymentData = storedPayment.paymentData;
        finalAmount = paymentData.total;
        discount = paymentData.discount;
        appliedCoupon = paymentData.coupon;
        specialInstructions = paymentData.specialInstructions || {};
        
        console.log('[Agent] 💰 Using stored payment data:', {
          finalAmount: '$' + finalAmount.toFixed(2),
          discount: '$' + discount.toFixed(2),
          coupon: appliedCoupon?.code || 'None'
        });
      }

      // Generate unique order number
      const orderNumber = Math.floor(10000 + Math.random() * 90000);
      const orderDate = new Date();

      console.log('[Agent] Creating order #', orderNumber);

      // Format order items with special instructions
      const orderItems = cart.items.map(item => ({
        product: item.name,
        title: item.name,
        price: item.price.toString(),
        quantity: item.quantity,
        total: (item.price * item.quantity).toString(),
        specialInstructions: specialInstructions[item.productId] || ''
      }));

      console.log('[Agent] Order items:', orderItems.length);

      // Create order in database
      // Create order in database
const order = await Order.create({
  order_number: orderNumber,
  amount: finalAmount.toFixed(2),
  amount_paid: finalAmount.toFixed(2),
  original_amount: cart.total.toFixed(2),     // ✅ Correct field name
  discount_amount: discount.toFixed(2),       // ✅ Correct field name (not 'discount')
  coupon_code: appliedCoupon?.code || null,   // ✅ Correct field name (not 'coupon')
  created_at: orderDate.toISOString(),
  date: orderDate.toISOString(),
  currency: 'USD',
  group_id: customerId,
  customer_id: customerId,
  line_items: orderItems,
  payment_method: 'CARD',
  status: 'CONFIRMED',
  orderNumberProvisional: orderNumber
});

console.log('[Agent] ✅ Order created in database:', {
  _id: order._id,
  orderNumber: order.order_number,
  amount: order.amount,
  original_amount: order.original_amount,         // ✅ Log correct field
  discount_amount: order.discount_amount,         // ✅ Log correct field
  coupon_code: order.coupon_code,                 // ✅ Log correct field
  items: order.line_items.length
});

      // Clear cart and stored payment data
      await this.clearCartItems(customerId);
      pendingPayments.delete(customerId); // ✅ Clean up
      console.log('[Agent] ✅ Cart cleared and payment data removed');

      console.log('==================== PAYMENT SUCCESS END ====================\n');

      // Build success message
      let successMessage = `🎉 Payment successful! Your order #${orderNumber} has been placed.\n\n📦 Order Details:\n• ${orderItems.length} item${orderItems.length !== 1 ? 's' : ''}\n`;
      
      if (discount > 0 && appliedCoupon) {
        successMessage += `• Original: $${cart.total}\n• Discount (${appliedCoupon.code}): -$${discount.toFixed(2)}\n• Total Paid: $${finalAmount.toFixed(2)} 💚\n`;
      } else {
        successMessage += `• Total: $${finalAmount.toFixed(2)}\n`;
      }
      
      successMessage += `• Status: Confirmed\n\nYou'll receive updates as your order is prepared. Thank you! 🍽️`;

      return {
        aiText: successMessage,
        intent: 'PAYMENT_SUCCESS',
        productList: [],
        addToCart: null,
        cartData: null,
        orderData: {
          type: 'order_confirmation',
          orders: [{
            id: order._id.toString(),
            orderNumber: order.order_number.toString(),
            status: 'preparing',
            date: orderDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            total: finalAmount,
            estimatedDelivery: this.getEstimatedDelivery(order),
            items: orderItems.map(item => ({
              name: item.product,
              quantity: item.quantity,
              price: parseFloat(item.price)
            }))
          }]
        },
        meta: {
         // suggestions: ['View all orders', 'Place another order', 'View Menu'],
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('\n==================== PAYMENT SUCCESS ERROR ====================');
      console.error('[Agent] Error:', error);
      console.error('[Agent] Stack:', error.stack);
      console.error('================================================================\n');
      
      pendingPayments.delete(customerId); // Clean up on error
      
      return {
        aiText: "There was an issue processing your order. Please contact support.",
        intent: 'PAYMENT_SUCCESS',
        productList: [],
        addToCart: null,
        cartData: null,
        orderData: null,
        meta: {
          suggestions: ['Contact support', 'Try again'],
          timestamp: new Date().toISOString()
        }
      };
    }
  }
  
  async handleOrderStatus(customerId) {
  try {
    const orders = await Order.find({ 
      $or: [{ group_id: customerId }, { customer_id: customerId }] 
    })
    .sort({ created_at: -1 })
    .limit(10)
    .lean();
    
    console.log(`[Agent] Found ${orders.length} orders for customer: ${customerId}`);
    
    if (orders.length === 0) {
      return { 
        aiText: "You don't have any orders yet. Ready to place your first order? 🎯", 
        intent: 'ORDER_STATUS', 
        productList: [], 
        addToCart: null, 
        cartData: null, 
        orderData: null, 
        meta: { 
          suggestions: ['View Menu', 'Browse Specials'], 
          timestamp: new Date().toISOString() 
        } 
      };
    }
    
    // ✅ Map orders with proper context
    const orderList = orders.map(o => {
      // ✅ Extract discount info
      const hasDiscount = o.discount_amount && parseFloat(o.discount_amount) > 0;
      const finalAmount = parseFloat(o.amount || 0);
      const originalAmount = o.original_amount ? parseFloat(o.original_amount) : finalAmount;
      const discountAmount = hasDiscount ? parseFloat(o.discount_amount) : 0;
      
      return {
        id: o._id.toString(), 
        orderNumber: o.order_number?.toString() || o._id.toString(), 
        status: this.mapOrderStatus(o.status), 
        date: new Date(o.created_at || o.date).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        }), 
        total: finalAmount,
        originalAmount: hasDiscount ? originalAmount : null,
        discount: discountAmount,
        couponCode: o.coupon_code || null,
        estimatedDelivery: this.getEstimatedDelivery(o), 
        items: (o.line_items || []).map(item => ({ 
          name: item.product || item.title || 'Unknown Item', 
          quantity: item.quantity || 1, 
          price: parseFloat(item.price || 0),
          specialInstructions: item.specialInstructions || null
        }))
      };
    });
    
    return { 
      aiText: '', 
      intent: 'ORDER_STATUS', 
      productList: [], 
      addToCart: null, 
      cartData: null, 
      orderData: { 
        type: 'order_tracking', 
        orders: orderList 
      }, 
      meta: { 
        //suggestions: ['Place new order', 'View Menu'], 
        timestamp: new Date().toISOString() 
      } 
    };
  } catch (error) {
    console.error('[Agent] Order status error:', error);
    return { 
      aiText: "I couldn't load your orders. Please try again.", 
      intent: 'ORDER_STATUS', 
      productList: [], 
      addToCart: null, 
      cartData: null, 
      orderData: null, 
      meta: { 
        suggestions: ['Try again', 'View Menu'], 
        timestamp: new Date().toISOString() 
      } 
    };
  }
}

  async handleTrackOrder(customerId, message, entities) {
  const orderId = entities.orderId || message.match(/\d{4,}/)?.[0];
  if (!orderId) {
    return { 
      aiText: "Please provide an order number to track. Example: 'Track order 12345'", 
      intent: 'TRACK_ORDER', 
      productList: [], 
      cartData: null, 
      orderData: null, 
      meta: { 
        suggestions: ['View order history', 'View Menu'], 
        timestamp: new Date().toISOString() 
      } 
    };
  }
  
  try {
    const order = await Order.findOne({ 
      order_number: parseInt(orderId), 
      $or: [{ group_id: customerId }, { customer_id: customerId }] 
    }).lean();
    
    if (!order) {
      return { 
        aiText: `Order #${orderId} not found. Please check the order number or view your order history.`, 
        intent: 'TRACK_ORDER', 
        productList: [], 
        cartData: null, 
        orderData: null, 
        meta: { 
          suggestions: ['View order history', 'Check another order'], 
          timestamp: new Date().toISOString() 
        } 
      };
    }

    // ✅ Extract discount info - handle missing fields
    const discountAmount = order.discount_amount ? parseFloat(order.discount_amount) : 0;
    const hasDiscount = discountAmount > 0;
    const finalAmount = parseFloat(order.amount || 0);
    const originalAmount = order.original_amount ? parseFloat(order.original_amount) : finalAmount;
    const couponCode = order.coupon_code || null;

    console.log('[Agent] 🔍 Order discount info:', {
      orderId,
      discount_amount: order.discount_amount,
      original_amount: order.original_amount,
      coupon_code: order.coupon_code,
      hasDiscount,
      discountAmount
    });

    // ✅ Format order details with discount info
    const orderDetails = { 
      id: order._id.toString(), 
      orderNumber: order.order_number.toString(),
      status: this.mapOrderStatus(order.status), 
      date: new Date(order.created_at || order.date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }), 
      total: finalAmount,
      originalAmount: hasDiscount ? originalAmount : null,
      discount: hasDiscount ? discountAmount : null, // ✅ Only include if > 0
      couponCode: hasDiscount ? couponCode : null, // ✅ Only include if discount exists
      estimatedDelivery: this.getEstimatedDelivery(order), 
      items: (order.line_items || []).map(item => ({ 
        name: item.product || item.title || 'Unknown Item', 
        quantity: item.quantity || 1, 
        price: parseFloat(item.price || 0),
        specialInstructions: item.specialInstructions || null
      })) 
    };
    
    // ✅ Build detailed text message
    const statusText = this.getStatusText(orderDetails.status);
    let responseText = `📦 **Order #${order.order_number}**\n\nStatus: ${statusText}\nDate: ${orderDetails.date}\n`;
    
    if (hasDiscount) {
      responseText += `\n💰 Payment:\nOriginal: $${originalAmount.toFixed(2)}\nDiscount${couponCode ? ` (${couponCode})` : ''}: -$${discountAmount.toFixed(2)}\nTotal Paid: $${finalAmount.toFixed(2)}\n`;
    } else {
      responseText += `Total: $${orderDetails.total.toFixed(2)}\n`;
    }
    
    responseText += `\n**Items (${orderDetails.items.length}):**\n`;
    orderDetails.items.forEach((item, idx) => { 
      responseText += `${idx + 1}. ${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`;
      if (item.specialInstructions) {
        responseText += `\n   📝 ${item.specialInstructions}`;
      }
      responseText += `\n`;
    });
    
    if (orderDetails.estimatedDelivery) { 
      responseText += `\n⏰ Estimated delivery: ${orderDetails.estimatedDelivery}`; 
    }
    
    console.log('[Agent] ✅ Order details prepared with discount:', {
      orderNumber: orderDetails.orderNumber,
      hasDiscount,
      discount: discountAmount.toFixed(2),
      coupon: couponCode || 'None'
    });
    
    return { 
      aiText: responseText, 
      intent: 'TRACK_ORDER', 
      productList: [], 
      cartData: null, 
      orderData: { 
        type: 'order_tracking', 
        orders: [orderDetails] 
      }, 
      meta: { 
        //suggestions: ['View all orders', 'Place new order', 'Reorder ' + orderId], 
        timestamp: new Date().toISOString() 
      } 
    };
  } catch (error) {
    console.error('[Agent] Track order error:', error);
    return { 
      aiText: `Error retrieving order #${orderId}. Please try again.`, 
      intent: 'TRACK_ORDER', 
      productList: [], 
      cartData: null, 
      orderData: null, 
      meta: { 
        suggestions: ['Try again', 'View order history'], 
        timestamp: new Date().toISOString() 
      } 
    };
  }
}

mapOrderStatus(status) {
  const statusMap = { 
    'CONFIRMED': 'preparing', 
    'PREPARING': 'preparing', 
    'READY': 'ready', 
    'OUT_FOR_DELIVERY': 'out_for_delivery', 
    'DELIVERED': 'delivered', 
    'CANCELLED': 'cancelled' 
  };
  return statusMap[status?.toUpperCase()] || 'preparing';
}

getEstimatedDelivery(order) {
  if (order.status === 'DELIVERED') return null;
  const orderDate = new Date(order.created_at || order.date);
  const estimatedTime = new Date(orderDate.getTime() + 45 * 60000);
  return estimatedTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

getStatusText(status) {
  const statusTexts = { 
    'preparing': '🍳 Being prepared', 
    'ready': '✅ Ready for pickup', 
    'out_for_delivery': '🚚 Out for delivery', 
    'delivered': '✅ Delivered', 
    'cancelled': '❌ Cancelled' 
  };
  return statusTexts[status] || 'Processing';
}

  async handleReorder(customerId, message, entities) {
  const orderId = entities.orderId || message.match(/\d{4,}/)?.[0];

  if (!orderId) {
    return {
      aiText: "Please provide an order number to reorder. Example: 'Reorder 12345'",
      intent: 'REORDER',
      productList: [],
      cartData: null,
      meta: {
        suggestions: ['View order history', 'View Menu'],
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    const order = await Order.findOne({ 
      order_number: parseInt(orderId),
      $or: [
        { group_id: customerId },
        { customer_id: customerId }
      ]
    }).lean();

    if (!order) {
      return {
        aiText: `Order #${orderId} not found. Please check the order number.`,
        intent: 'REORDER',
        productList: [],
        cartData: null,
        meta: {
          suggestions: ['View order history', 'View Menu'],
          timestamp: new Date().toISOString()
        }
      };
    }

    // Add all items from the order to cart
    for (const item of order.line_items || []) {
      try {
        // Find product by name
        const product = await Product.findOne({ name: item.product || item.title });
        if (product) {
          await this.addItemToCart(customerId, product._id.toString(), item.quantity || 1);
        }
      } catch (error) {
        console.error('[Agent] Error adding item during reorder:', error);
      }
    }

    // Get updated cart
    const cart = await this.getCart(customerId);

    return {
      aiText: `✅ Reordered items from Order #${orderId}! Your cart has been updated.`,
      intent: 'REORDER',
      productList: [],
      cartData: {
        text: '',
        type: 'cart_display',
        cartItems: cart.cartItems,
        cartTotal: cart.cartTotal
      },
      meta: {
        suggestions: ['Proceed to pay', 'Add more items', 'View cart'],
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('[Agent] Reorder error:', error);
    return {
      aiText: `Error processing reorder. Please try again.`,
      intent: 'REORDER',
      productList: [],
      cartData: null,
      meta: {
        suggestions: ['Try again', 'View Menu'],
        timestamp: new Date().toISOString()
      }
    };
  }
}
  async handleRemoveFromCart(customerId, message, entities) {
    try {
      const products = await searchSimilar(message, 1);
      if (products.length > 0) {
        await this.removeItemFromCart(customerId, products[0].id);
        const cart = await this.getCart(customerId);
        return { aiText: `Removed ${products[0].name} from your cart.`, intent: 'REMOVE_FROM_CART', productList: [], cartData: cart.items.length > 0 ? { text: '', type: 'cart_display', cartItems: cart.cartItems, cartTotal: cart.cartTotal } : null, meta: { suggestions: ['Add more items', 'Proceed to pay'], timestamp: new Date().toISOString() } };
      }
      return { aiText: "Item not found in cart.", intent: 'REMOVE_FROM_CART', productList: [], cartData: null, meta: { suggestions: ['View cart', 'View Menu'], timestamp: new Date().toISOString() } };
    } catch (error) {
      console.error('[Agent] Remove from cart error:', error);
      return { aiText: "Error removing item.", intent: 'REMOVE_FROM_CART', productList: [], cartData: null, meta: { suggestions: ['Try again'], timestamp: new Date().toISOString() } };
    }
  }

  async handleClearCart(customerId) {
    try {
      await this.clearCartItems(customerId);
      return { aiText: "Your cart has been cleared! 🗑️", intent: 'CLEAR_CART', productList: [], cartData: null, meta: { suggestions: ['View Menu', 'Browse Specials'], timestamp: new Date().toISOString() } };
    } catch (error) {
      console.error('[Agent] Clear cart error:', error);
      return { aiText: "Error clearing cart. Please try again.", intent: 'CLEAR_CART', productList: [], cartData: null, meta: { suggestions: ['Try again', 'View cart'], timestamp: new Date().toISOString() } };
    }
  }
  async handleApplyCoupon(customerId, message, entities) {
  const couponCode = entities.couponCode || message.match(/[A-Z0-9]{5,}/)?.[0];
  
  if (!couponCode) {
    return {
      aiText: "Please provide a valid coupon code. Example: 'apply coupon SAVE10'",
      intent: 'APPLY_COUPON',
      productList: [],
      cartData: null,
      meta: { suggestions: ['View cart', 'Proceed to checkout'], timestamp: new Date().toISOString() }
    };
  }

  try {
    // ✅ Validate coupon (you can check database or hardcode valid coupons)
    const validCoupons = {
      'SAVE10': { code: 'SAVE10', discount: 10, description: '10% off your order' },
      'SAVE20': { code: 'SAVE20', discount: 20, description: '20% off your order' },
      'WELCOME': { code: 'WELCOME', discount: 15, description: '15% off for new customers' }
    };

    const coupon = validCoupons[couponCode.toUpperCase()];
    
    if (!coupon) {
      return {
        aiText: `Sorry, coupon code "${couponCode}" is not valid. Try SAVE10 or SAVE20.`,
        intent: 'APPLY_COUPON',
        productList: [],
        cartData: null,
        meta: { suggestions: ['View cart', 'Try another coupon'], timestamp: new Date().toISOString() }
      };
    }

    // ✅ Get current cart
    const cart = await this.getCart(customerId);
    
    if (!cart.items || cart.items.length === 0) {
      return {
        aiText: "Your cart is empty! Add some items first before applying a coupon.",
        intent: 'APPLY_COUPON',
        productList: [],
        cartData: null,
        meta: { suggestions: ['View Menu'], timestamp: new Date().toISOString() }
      };
    }

    // ✅ Calculate discount
    const subtotal = cart.total;
    const discountAmount = subtotal * (coupon.discount / 100);
    const newTotal = subtotal - discountAmount;

    console.log('[Agent] ✅ Coupon applied:', {
      code: coupon.code,
      subtotal: subtotal,
      discount: discountAmount,
      total: newTotal
    });

    // ✅ Return cart with coupon
    return {
      aiText: `✅ Coupon ${coupon.code} applied! You saved $${discountAmount.toFixed(2)}`,
      intent: 'APPLY_COUPON',
      productList: [],
      cartData: {
        text: '',
        type: 'cart_display',
        cartItems: cart.cartItems,
        cartTotal: newTotal,
        subtotal: subtotal,
        discount: discountAmount,
        coupon: coupon
      },
      meta: { 
        suggestions: ['Proceed to checkout', 'Remove coupon', 'Add more items'], 
        timestamp: new Date().toISOString() 
      }
    };

  } catch (error) {
    console.error('[Agent] Apply coupon error:', error);
    return {
      aiText: "Error applying coupon. Please try again.",
      intent: 'APPLY_COUPON',
      productList: [],
      cartData: null,
      meta: { suggestions: ['Try again', 'View cart'], timestamp: new Date().toISOString() }
    };
  }
}

async handleRemoveCoupon(customerId) {
  try {
    const cart = await this.getCart(customerId);
    
    if (!cart.items || cart.items.length === 0) {
      return {
        aiText: "Your cart is empty!",
        intent: 'REMOVE_COUPON',
        productList: [],
        cartData: null,
        meta: { suggestions: ['View Menu'], timestamp: new Date().toISOString() }
      };
    }

    // ✅ Return cart without coupon
    return {
      aiText: "Coupon removed from your cart.",
      intent: 'REMOVE_COUPON',
      productList: [],
      cartData: {
        text: '',
        type: 'cart_display',
        cartItems: cart.cartItems,
        cartTotal: cart.total,
        subtotal: cart.total,
        discount: 0,
        coupon: null
      },
      meta: { 
        suggestions: ['Apply coupon', 'Proceed to checkout'], 
        timestamp: new Date().toISOString() 
      }
    };

  } catch (error) {
    console.error('[Agent] Remove coupon error:', error);
    return {
      aiText: "Error removing coupon.",
      intent: 'REMOVE_COUPON',
      productList: [],
      cartData: null,
      meta: { suggestions: ['Try again'], timestamp: new Date().toISOString() }
    };
  }
}

  async handleLearnPreference(customerId, message, entities) {
    return { aiText: "Thanks for sharing your preference! I'll remember that. 😊", intent: 'LEARN_PREFERENCE', productList: [], cartData: null, meta: { suggestions: ['View Menu', 'Show recommendations'], timestamp: new Date().toISOString() } };
  }

  async getCart(customerId) {
    console.log('\n==================== GET CART START ====================');
    console.log('[Agent] Getting cart for customer:', customerId);
    try {
      let cart = await Cart.findOne({ customer_id: customerId });
      if (!cart) {
        console.log('[Agent] No cart found, creating new cart');
        cart = await Cart.create({ id: uuidv4(), customer_id: customerId, created_at: new Date(), updated_at: new Date() });
      }
      console.log('[Agent] Found cart:', { _id: cart._id, id: cart.id, customer_id: cart.customer_id });
      const items = await CartItem.find({ cart_id: cart.id });
      console.log('[Agent] Found cart items:', items.length);
      if (items.length === 0) {
        console.log('==================== GET CART END (EMPTY) ====================\n');
        return { items: [], cartItems: [], cartTotal: 0, itemCount: 0, total: 0 };
      }
      console.log('[Agent] Processing cart items...');
      const cartItems = [];
      let total = 0;
      let itemCount = 0;
      for (const item of items) {
        console.log('[Agent] Processing item:', item.quantity, 'x', { id: item.id, productId: item.productId, title: item.title });
        const product = await Product.findOne({ _id: item.productId });
        if (product) {
          const itemData = { id: item.id, productId: item.productId.toString(), name: product.name || item.title, price: parseFloat(product.price || 0), quantity: item.quantity || 1, image: product.image || product.imageUrl || '' };
          cartItems.push(itemData);
          total += itemData.price * itemData.quantity;
          itemCount += itemData.quantity;
        }
      }
      console.log('[Agent] Valid items after processing:', cartItems.length);
      const result = { items: cartItems, cartItems: cartItems, cartTotal: parseFloat(total.toFixed(2)), total: parseFloat(total.toFixed(2)), itemCount: itemCount };
      console.log('[Agent] Returning cart data:', { itemCount: result.itemCount, total: result.total });
      console.log('==================== GET CART END (SUCCESS) ====================\n');
      return result;
    } catch (error) {
      console.error('[Agent] ❌ Get cart error:', error);
      console.log('==================== GET CART END (ERROR) ====================\n');
      return { items: [], cartItems: [], cartTotal: 0, itemCount: 0, total: 0 };
    }
  }

  async addItemToCart(customerId, productId, quantity) {
    console.log('\n==================== ADD TO CART START ====================');
    console.log('[Agent] Customer ID:', customerId);
    console.log('[Agent] Product ID:', productId);
    console.log('[Agent] Quantity:', quantity);
    try {
      console.log('\n[Step 1] Finding product...');
      const product = await Product.findById(productId);
      if (!product) {
        console.log('[Agent] ❌ Product not found:', productId);
        throw new Error('Product not found');
      }
      console.log('[Agent] ✅ Found product:', { _id: product._id, name: product.name, price: product.price });
      console.log('\n[Step 2] Getting/creating cart...');
      let cart = await Cart.findOne({ customer_id: customerId });
      if (!cart) {
        console.log('[Agent] Creating new cart...');
        cart = await Cart.create({ id: uuidv4(), customer_id: customerId, created_at: new Date(), updated_at: new Date() });
      }
      console.log('[Agent] ✅ Using existing cart:', { _id: cart._id, id: cart.id, customer_id: cart.customer_id });
      console.log('\n[Step 3] Creating/updating cart item...');
      console.log('[Agent] Using product ID:', productId.toString());
      console.log('[Agent] Using cart ID:', cart.id);
      let cartItem = await CartItem.findOne({ cart_id: cart.id, productId: productId.toString() });
      if (cartItem) {
        console.log('[Agent] Found existing cart item. Updating quantity...');
        console.log('[Agent] Old quantity:', cartItem.quantity);
        cartItem.quantity += quantity;
        cartItem.updated_at = new Date();
        await cartItem.save();
        console.log('[Agent] ✅ Updated cart item:', { id: cartItem.id, quantity: cartItem.quantity });
      } else {
        console.log('[Agent] No existing item. Creating new cart item...');
        const itemData = { id: uuidv4(), cart_id: cart.id, productId: productId.toString(), title: product.name, unit_price: parseFloat(product.price), quantity: quantity, created_at: new Date(), updated_at: new Date() };
        console.log('[Agent] Cart item data to create:', itemData);
        cartItem = await CartItem.create(itemData);
        console.log('[Agent] ✅ Created cart item:', { _id: cartItem._id, id: cartItem.id, cart_id: cartItem.cart_id, productId: cartItem.productId, quantity: cartItem.quantity });
        const verifyItem = await CartItem.findOne({ id: cartItem.id });
        if (verifyItem) {
          console.log('[Agent] ✅ Cart item verified in database');
        } else {
          console.log('[Agent] ⚠️ Warning: Could not verify cart item in database');
        }
      }
      console.log('\n[Step 4] Final verification...');
      const allItems = await CartItem.find({ cart_id: cart.id });
      console.log('[Agent] ✅ Total items in cart:', allItems.length);
      console.log('[Agent] Cart items:', allItems.map(i => ({ id: i.id, productId: i.productId, title: i.title, quantity: i.quantity })));
      console.log('==================== ADD TO CART SUCCESS ====================\n');
      return cartItem;
    } catch (error) {
      console.error('\n==================== ADD TO CART ERROR ====================');
      console.error('[Agent] Error:', error);
      console.error('[Agent] Stack:', error.stack);
      console.error('===========================================================\n');
      throw error;
    }
  }

  async removeItemFromCart(customerId, productId) {
    try {
      const cart = await Cart.findOne({ customer_id: customerId });
      if (!cart) return;
      await CartItem.deleteOne({ cart_id: cart.id, productId: productId });
      console.log('[Agent] ✅ Removed item from cart:', productId);
    } catch (error) {
      console.error('[Agent] Remove from cart error:', error);
      throw error;
    }
  }

  async clearCartItems(customerId) {
    try {
      const cart = await Cart.findOne({ customer_id: customerId });
      if (!cart) return;
      await CartItem.deleteMany({ cart_id: cart.id });
      console.log('[Agent] ✅ Cart cleared for customer:', customerId);
    } catch (error) {
      console.error('[Agent] Clear cart error:', error);
      throw error;
    }
  }
}

module.exports = new AgentService();