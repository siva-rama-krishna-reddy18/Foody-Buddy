// src/services/agentService.js
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();
const { classifyIntent } = require('./intentService');
const { searchSimilar } = require('./vectorService');
const { generateEmbedding } = require('./embeddingService');
const aiResponseService = require('./aiResponseService'); 

const DEBUG = process.env.NODE_ENV === 'development';

class AgentService {
  constructor() {
    this.sessionMemory = new Map();
    if (DEBUG) console.log('[Agent] Enhanced AgentService initialized with AI and payment support');
  }

  // Add this to your agentService.js respond method - replace the existing respond method:

async respond({ sessionId, customerId, text }) {
  try {
    const result = await this.processMessage(customerId, sessionId, text);
    
    // Handle cart response differently
    if (typeof result.response === 'object' && result.response.cartItems) {
      console.log(' [Agent] TAKING CART PATH');
      return {
        aiText: result.response,  // Pass the entire cart object
        intent: result.intent,
        productList: result.products || [],
        addToCart: await this.getCartData(customerId),
        cartData: result.response, // Also include as cartData
        meta: {
          suggestions: result.suggestions || [],
          timestamp: new Date().toISOString()
        }
      };
    }

    // Handle order tracking response
    if (typeof result.response === 'object' && result.response.orders) {
      console.log(' [Agent] TAKING ORDER TRACKING PATH');
      return {
        aiText: '', // Empty text since we show interactive component
        intent: result.intent,
        productList: result.products || [],
        addToCart: await this.getCartData(customerId),
        orderData: result.response, // Pass order data
        meta: {
          suggestions: result.suggestions || [],
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Handle payment response
    if (typeof result.response === 'object' && result.response.payment) {
      console.log(' [Agent] TAKING PAYMENT PATH');
      return {
        aiText: result.response.text,
        intent: result.intent,
        productList: result.products || [],
        addToCart: await this.getCartData(customerId),
        payment: result.response.payment,
        meta: {
          suggestions: result.suggestions || [],
          timestamp: new Date().toISOString()
        }
      };
    }
    
    console.log(' [Agent] TAKING NORMAL PATH');
    return {
      aiText: result.response,
      intent: result.intent,
      productList: result.products || [],
      addToCart: await this.getCartData(customerId),
      cartData: result.cartData,
      meta: {
        suggestions: result.suggestions || [],
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[Agent] Error in respond:', error);
    return {
      aiText: "I'm having some technical difficulties. Please try again in a moment.",
      intent: 'ERROR',
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


// Replace your existing handleOrderStatus method with this enhanced version:
// Replace your handleOrderStatus method in agentService.js with this:

async handleOrderStatus(customerId) {
  try {
    console.log('[Agent] Checking orders for customer:', customerId);
    let orders = [];
    
    try {
      orders = await prisma.order.findMany({
        where: { customerId: customerId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          orderLineItems: {
            take: 3
          }
        }
      });
    } catch (error) {
      console.log('[Agent] Order lookup failed:', error.message);
    }

    if (orders.length === 0) {
      return "You don't have any recent orders. Would you like to place a new order? I can show you our popular items or help you search for something specific!";
    }

    // IMPORTANT: Return structured data object, not text
    const orderData = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber || 'N/A',
      status: this.mapOrderStatus(order.status || 'delivered'),
      date: new Date(order.createdAt || order.created_at).toLocaleDateString(),
      total: parseFloat(order.amount || order.total_amount || 0),
      estimatedDelivery: this.getEstimatedDelivery(order.status),
      items: (order.orderLineItems || []).map(item => ({
        name: item.productName || 'Item',
        quantity: item.quantity || 1,
        price: parseFloat(item.price || 0)
      }))
    }));

    // Return the structured object that triggers interactive component
    return {
      type: 'order_tracking',
      orders: orderData
    };

  } catch (error) {
    console.error('[Agent] Order status error:', error);
    return "I'm having trouble accessing your order history right now. Would you like to place a new order instead?";
  }
}

// Add these helper methods to your AgentService class:
mapOrderStatus(status) {
  const statusMap = {
    'PENDING': 'preparing',
    'CONFIRMED': 'preparing', 
    'PREPARING': 'preparing',
    'READY': 'ready',
    'OUT_FOR_DELIVERY': 'out_for_delivery',
    'DELIVERED': 'delivered',
    'CANCELLED': 'cancelled'
  };
  
  return statusMap[status?.toUpperCase()] || 'delivered';
}

getEstimatedDelivery(status) {
  const now = new Date();
  
  switch (status?.toUpperCase()) {
    case 'PENDING':
    case 'CONFIRMED':
      const prepTime = new Date(now.getTime() + 10 * 60000); // 10 minutes
      return prepTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case 'PREPARING':
      const cookTime = new Date(now.getTime() + 5 * 60000); // 5 minutes
      return cookTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case 'OUT_FOR_DELIVERY':
      const deliveryTime = new Date(now.getTime() + 10 * 60000); // 10 minutes
      return deliveryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    default:
      return null;
  }
}

async processMessage(customerId, sessionId, message) {
  try {
    if (DEBUG) console.log(`[Agent] Processing: "${message}" for customer: ${customerId}`);

    await this.logInteraction(customerId, sessionId, message);

    const intent = await classifyIntent(message);
    if (DEBUG) console.log(`[Agent] Intent: ${intent}`);

    let response;
    let products = [];
    let suggestions = [];
    let cartData = null; // Add this variable

    // Handle different intents
    switch (intent) {
      case 'GREETING':
        response = await this.handleGreeting(customerId);
        suggestions = ['View Menu', 'Show my cart', 'Track Orders'];
        break;

      case 'ORDER_STATUS':
        response = await this.handleOrderStatus(customerId);
        suggestions = ['Show recommendations', 'View menu'];
        break;
        
      case 'TRACK_ORDER':
        response = await this.handleOrderTracking(message);
        suggestions = ['Do you need any assistance?','View menu', 'Show recommendations'];
        break;

      case 'RECOMMEND':
        ({ response, products } = await this.handleRecommendations(customerId));
        suggestions = ['Add to cart', 'Show my cart'];
        break;

      case 'SEARCH':
        ({ response, products } = await this.handleSearch(message));
        suggestions = ['Add to cart', 'Show recommendations'];
        break;

      case 'ADD_TO_CART':
        response = await this.handleAddToCart(customerId, sessionId, message);
        suggestions = ['Show my cart', 'Proceed to pay', 'Continue shopping'];
        break;

      case 'VIEW_CART':
        const cartResult = await this.handleViewCart(customerId);
        
        // Check if cart result is an object with cart data
        if (typeof cartResult === 'object' && cartResult.cartItems) {
          response = cartResult.text;
          cartData = {
            type: 'cart_display',
            cartItems: cartResult.cartItems,
            cartTotal: cartResult.cartTotal
          };
        } else {
          response = cartResult; // String response for empty cart
        }
        
        suggestions = ['Proceed to pay', 'Add more items', 'Clear cart'];
        break;

      case 'CHECKOUT':
        response = await this.handleCheckout(customerId);
        break;

      case 'UPDATE_CART_QUANTITY':
        if (message.includes('increase')) {
          const productId = message.match(/increase quantity of (.+)/)?.[1];
          response = await this.handleUpdateCartQuantity(customerId, productId, 'increase');
        } else if (message.includes('decrease')) {
          const productId = message.match(/decrease quantity of (.+)/)?.[1];
          response = await this.handleUpdateCartQuantity(customerId, productId, 'decrease');
        }
        suggestions = ['Show my cart', 'Proceed to pay'];
        break;

      case 'REMOVE_FROM_CART':
        const productId = message.match(/remove (.+) from cart/)?.[1];
        response = await this.handleRemoveFromCart(customerId, productId);
        suggestions = ['Show my cart', 'Add more items'];
        break;

      case 'REORDER':
  response = await this.handleReorder(customerId, message);
  suggestions = ['Show my cart', 'Proceed to pay', 'Add more items'];
  break;
      case 'VIEW_COUPONS':
  response = await this.handleViewCoupons();
  suggestions = ['Apply coupon', 'View menu', 'Show my cart'];
  break;

      /*case 'GET_CUSTOMER_INFO':
  response = await this.handleCustomerInfoQuery(message);
  suggestions = ['Track order', 'View menu', 'Show recommendations'];
   break;
   */

case 'VERIFY_COUPON_USAGE':
  response = await this.handleCouponVerification(message);
  suggestions = ['View coupons', 'Track order', 'View menu'];
  break;

case 'GET_SPECIAL_INSTRUCTIONS':
  response = await this.handleSpecialInstructions(message);
  suggestions = ['Track order', 'View menu'];
  break;

case 'SEARCH_BY_CUSTOMER':
  response = await this.handleCustomerSearch(message);
  suggestions = ['Track order', 'View menu'];
  break;

case 'TRACK_PROVISIONAL_ORDER':
  response = await this.handleProvisionalOrderTracking(message);
  suggestions = ['Track order', 'View menu'];
  break;

      case 'CLEAR_CART':
  response = await this.handleClearCart(customerId);
  suggestions = ['View menu', 'Show recommendations', 'Add items'];
  break;
       
      case 'PAYMENT_SUCCESS':
  cartData = await this.getCartData(customerId);
  const paymentTotal = cartData ? cartData.total : 0;
  response = await this.handlePaymentSuccess(customerId, { total: paymentTotal });
  cartData = null; // Clear cart data after successful payment
  suggestions = ['Track Orders', 'View Menu', 'Add more items'];
  break;

      case 'LEARN_PREFERENCE':
        response = await this.handlePreferenceLearning(customerId, message);
        suggestions = ['Show recommendations', 'View menu'];
        break;

      // In agentService.js processMessage method, modify the UNKNOWN case:
case 'UNKNOWN':
default:
  // Check if this is a reorder request
  if (message.toLowerCase().includes('reorder') && /\b\d{3,}\b/.test(message)) {
    response = await this.handleReorder(customerId, message);
    suggestions = ['Show my cart', 'Proceed to pay', 'Add more items'];
  } else {
    console.log('[Agent] Using AI for conversational response');
    const conversationalResult = await this.handleConversationalQuery(message, sessionId, customerId, intent);
    
    if (typeof conversationalResult === 'object' && conversationalResult.products) {
      response = conversationalResult.response;
      products = conversationalResult.products;
      suggestions = ['Add to cart', 'Show more options', 'Show my cart'];
    } else {
      response = conversationalResult;
      suggestions = ['View Menu', 'Show my cart', 'Track Orders'];
    }
  }
  break;
}

    await this.logInteraction(customerId, sessionId, message, intent, null, response, products);

    return {
      intent,
      response,
      products,
      suggestions,
      cartData // Include cartData in the return
    };

  } catch (error) {
    console.error('[Agent] Error:', error);
    return {
      intent: 'ERROR',
      response: "I'm having some technical difficulties. Please try again in a moment.",
      products: [],
      suggestions: ['Try again', 'View Menu']
    };
  }
}
async getCartData(customerId) {
  try {
    let cart = await prisma.carts.findFirst({
      where: { customer_id: customerId }
    });

    if (!cart) {
      return null;
    }

    const cartItems = await prisma.cartItem.findMany({
      where: { cart_id: cart.id },
      include: { products: true }
    });
    
    if (cartItems.length === 0) return null;
    
    const total = cartItems.reduce((sum, item) => {
      return sum + (parseFloat(item.unit_price || item.products?.price || 0) * item.quantity);
    }, 0);
    
    return {
      items: cartItems.map(item => ({
        id: item.id,
        productId: item.productId,
        name: item.title || item.products?.name,
        price: parseFloat(item.unit_price || item.products?.price || 0),
        quantity: item.quantity,
        total: parseFloat(item.unit_price || item.products?.price || 0) * item.quantity
      })),
      total: parseFloat(total.toFixed(2)),
      itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0)
    };
  } catch (error) {
    console.error('[Agent] Cart data error:', error);
    return null;
  }
}

  // NEW: Handle conversational queries using AI
// In agentService.js - Update the handleConversationalQuery method
async handleConversationalQuery(message, sessionId, customerId, intent) {
  try {
    // Get cart context for AI
    const cartData = await this.getCartData(customerId);
    let context = ['FoodyBuddy Indian restaurant', 'Specializing in authentic Indian cuisine'];
    
    if (cartData && cartData.items.length > 0) {
      context.push(`Customer has ${cartData.itemCount} items in cart (total: $${cartData.total})`);
      context.push(`Cart items: ${cartData.items.map(item => item.name).join(', ')}`);
    }

    // Try AI service first
    const aiResponse = await aiResponseService.getAIResponse(message, sessionId, {
      intent: intent,
      context: context
    });

    // IMPROVED VALIDATION: Check if AI response addresses the user's query
    const lowerMessage = message.toLowerCase();
    const lowerResponse = aiResponse ? aiResponse.toLowerCase() : '';
    
    // If user asks for specific items, AI should mention them or similar items
    const isProductQuery = lowerMessage.includes('paneer') || lowerMessage.includes('chicken') || 
                          lowerMessage.includes('biryani') || lowerMessage.includes('curry') ||
                          lowerMessage.includes('tea') || lowerMessage.includes('rice') ||
                          lowerMessage.includes('naan') || lowerMessage.includes('samosa');
    
    if (aiResponse && 
        aiResponse.trim().length > 0 && 
        !aiResponse.includes('Here are some FoodyBuddy picks to get started')) {
      
      // If it's a product query, check if AI actually addressed it
      if (isProductQuery) {
        // Check if AI response mentions the requested item or similar items
        const mentionsRequestedItem = lowerMessage.split(' ').some(word => 
          word.length > 3 && lowerResponse.includes(word)
        );
        
        if (!mentionsRequestedItem) {
          console.log('[Agent] AI response doesn\'t address product query, falling back to vector search');
          throw new Error('AI response doesn\'t address specific product request');
        }
      }
      
      console.log('[Agent] AI response successful');
      return aiResponse;
    } else {
      console.log('[Agent] AI response invalid, falling back to vector search');
      throw new Error('AI response invalid or empty');
    }

  } catch (error) {
    console.error('[Agent] AI failed, using vector search fallback:', error.message);
    
    // FALLBACK: Use vector search for product recommendations
    try {
      const vectorResults = await this.searchProducts(message);
      
      if (vectorResults && vectorResults.length > 0) {
        console.log('[Agent] Vector search fallback successful');
        
        // Create a natural response with vector results
        const productList = vectorResults.slice(0, 3).map(product => 
          `• ${product.name} - $${product.price}`
        ).join('\n');
        
        return {
          // response: ``,
          products: vectorResults
        };
      }
    } catch (vectorError) {
      console.error('[Agent] Vector search fallback also failed:', vectorError.message);
    }
    
    // If both AI and vector search fail
    return "I'm having trouble understanding that request. Could you try asking me to search for specific items or view our menu?";
  }
}
  // Handle checkout/payment
  async handleCheckout(customerId) {
    try {
      const cartData = await this.getCartData(customerId);
      
      if (!cartData || cartData.items.length === 0) {
        return "Your cart is empty! Add some items to your cart first, then I can help you checkout.";
      }

      return {
        text: "Perfect! Let's process your payment for your order.",
        payment: {
          total: cartData.total,
          items: cartData.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          }))
        }
      };
    } catch (error) {
      console.error('[Agent] Checkout error:', error);
      return "I'm having trouble accessing your cart for checkout. Please try again.";
    }
  }

  async handlePaymentSuccess(customerId, paymentData = null) {
  try {
    // Get current cart data if paymentData not provided
    if (!paymentData) {
      const cartData = await this.getCartData(customerId);
      paymentData = { total: cartData ? cartData.total : 0 };
    }

    console.log('[Agent] Payment success for customer:', customerId);
    console.log('[Agent] Payment amount:', paymentData.total);
    
    // Clear cart first
    const cart = await prisma.carts.findFirst({
      where: { customer_id: customerId }
    });

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cart_id: cart.id }
      });
    }

    const orderNumber = Math.floor(100000 + Math.random() * 500000);
    
    const newOrder = await prisma.order.create({
      data: {
        orderNumber: orderNumber,
        customerId: customerId,
        amount: paymentData.total, // Dynamic amount
        status: 'CONFIRMED',
        createdAt: new Date(),
      }
    });
    
    return `Payment successful! Your order #${orderNumber} has been confirmed for $${paymentData.total}. Thank you for choosing FoodyBuddy!`;
    
  } catch (error) {
    console.error('[Agent] Payment success error:', error);
    return "Payment was successful! Your order is being prepared. Thank you!";
    
  }
}

  async handleGreeting(customerId) {
    try {
      let customer = null;
      try {
        customer = await prisma.customer.findUnique({
          where: { phone: customerId }
        });
      } catch (error) {
        try {
          customer = await prisma.customer.findUnique({
            where: { id: customerId }
          });
        } catch (fallbackError) {
          if (DEBUG) console.log('[Agent] Customer lookup failed:', fallbackError.message);
        }
      }

      if (customer) {
        let recentOrders = [];
        try {
          recentOrders = await prisma.order.findMany({
            where: { customer_id: customerId },
            orderBy: { created_at: 'desc' },
            take: 2,
            include: {
              order_items: {
                take: 3,
                include: {
                  product: true
                }
              }
            }
          });
        } catch (error) {
          try {
            recentOrders = await prisma.order.findMany({
              where: { customerId: customerId },
              orderBy: { createdAt: 'desc' },
              take: 2,
              include: {
                orderLineItems: {
                  take: 3
                }
              }
            });
          } catch (fallbackError) {
            if (DEBUG) console.log('[Agent] Order history lookup failed:', fallbackError.message);
          }
        }

        if (recentOrders.length > 0) {
          const orderSummary = recentOrders.map(order => {
            let items = '';
            let total = '';
            let date = '';
            
            if (order.order_items) {
              items = order.order_items.slice(0, 2).map(item => item.product?.name || 'Item').join(', ');
              total = order.total_amount || order.total || '0';
              date = new Date(order.created_at || order.createdAt).toLocaleDateString();
            } else if (order.orderLineItems) {
              items = order.orderLineItems.slice(0, 2).map(item => item.productName).join(', ');
              total = order.total || '0';
              date = new Date(order.createdAt).toLocaleDateString();
            }

            return `Order: ${items} (${date}) - $${total}`;
          }).join('\n- ');

          return `Welcome back, ${customer.name || 'valued customer'}! I see you've ordered from us before.\n\nWhat can I help you order today?`;
        }
      }

      return "Welcome to FoodyBuddy! I'm your AI assistant here to help you order delicious food. What can I help you with today?";
    } catch (error) {
      console.error('[Agent] Greeting error:', error);
      return "Welcome to FoodyBuddy! What can I help you order today?";
    }
  }


  async handleOrderTracking(message) {
    try {
      // Extract order ID from message
      const orderIdMatch = message.match(/\b(\d{3,})\b/);
      
      if (!orderIdMatch) {
        return "Please provide your order ID. For example: 'Track order 12345' or just enter the order number.";
      }
      
      const orderId = orderIdMatch[1];
      
      // Search for order by order number
      let order = null;
      
      try {
        // Search for order by order number only
        order = await prisma.order.findFirst({
          where: {
            orderNumber: parseInt(orderId)
          },
          include: {
            orderLineItems: true  // Remove the product include since relation doesn't exist
          }
        });
        
        // If we found the order but product names are missing, fetch them manually
        if (order && order.orderLineItems) {
          for (let item of order.orderLineItems) {
            if (!item.productName && item.productId) {
              try {
                const product = await prisma.product.findUnique({
                  where: { id: item.productId }
                });
                if (product) {
                  item.productName = product.name; // Add the product name to the item
                }
              } catch (productError) {
                console.log('[Agent] Could not fetch product for item:', item.productId);
              }
            }
          }
        }
      } catch (error) {
        console.error('[Agent] Order lookup error:', error);
      }
      
      if (!order) {
        return `I couldn't find an order with ID "${orderId}". Please check your order number and try again. You can find your order ID in your confirmation email or receipt.`;
      }
      
      // Format order status response
      const orderNumber = order.orderNumber || order.order_number || order.id;
      const status = order.status || 'Processing';
      const createdDate = new Date(order.createdAt || order.created_at).toLocaleDateString();
      const amount = order.amount || order.total_amount || '0';
      
      // Calculate estimated delivery time based on status
      let statusMessage = '';
      let estimatedTime = '';
      
      switch (status.toUpperCase()) {
        case 'PENDING':
        case 'CONFIRMED':
          statusMessage = 'Order confirmed and being prepared';
          estimatedTime = '25-35 minutes';
          break;
        case 'PREPARING':
          statusMessage = 'Your order is being prepared in our kitchen';
          estimatedTime = '15-25 minutes';
          break;
        case 'OUT_FOR_DELIVERY':
          statusMessage = 'Order is out for delivery';
          estimatedTime = '10-15 minutes';
          break;
        case 'DELIVERED':
          statusMessage = 'Order has been delivered';
          estimatedTime = 'Completed';
          break;
        case 'CANCELLED':
          statusMessage = 'Order was cancelled';
          estimatedTime = 'N/A';
          break;
        
        default:
          statusMessage = `Order status: ${status}`;
          estimatedTime = 'Please contact support for details';
      }
      
      // Build order items list with debugging
      let itemsList = '';
if (order.orderLineItems && order.orderLineItems.length > 0) {
  itemsList = '\n\nItems:\n' + order.orderLineItems.map(item => {
    const productName = item.productName || `Product ID: ${item.productId}` || 'Unknown Item';
    const quantity = item.quantity || 1;
    const price = item.price || 0;
    const instructions = item.specialInstructions ? ` (Note: ${item.specialInstructions})` : '';
    
    return `• ${productName} x${quantity} - $${parseFloat(price).toFixed(2)}${instructions}`;
  }).join('\n');
}
      
      const response = `Order #${orderNumber} Status:

${statusMessage}
Amount: $${amount}
Order Date: ${createdDate}
${estimatedTime !== 'N/A' && estimatedTime !== 'Completed' ? `Estimated Time: ${estimatedTime}` : ''}${itemsList}

${status.toUpperCase() === 'DELIVERED' ? 'Thank you for your order!' : 'We\'ll notify you of any updates!'}`;
      
      return response;
      
    } catch (error) {
      console.error('[Agent] Order tracking error:', error);
      return "I'm having trouble accessing order information right now. Please try again or contact our support team.";
    }
  }

  async handleReorder(customerId, message) {
  try {
    // Extract order number from message
    const orderMatch = message.match(/\b(\d{3,})\b/);
    
    if (!orderMatch) {
      return "Please specify which order you'd like to reorder. For example: 'Reorder 403097'";
    }
    
    const orderNumber = orderMatch[1];
    
    // Find the order
    const order = await prisma.order.findFirst({
      where: { orderNumber: parseInt(orderNumber) },
      include: { orderLineItems: true }
    });

    console.log(`[Agent] Found order:`, order);
    console.log(`[Agent] Order items:`, order?.orderLineItems);
    
    if (!order || !order.orderLineItems || order.orderLineItems.length === 0) {
      return `I couldn't find order #${orderNumber} or it has no items to reorder.`;
    }
    
    // Add items back to cart
    let cart = await prisma.carts.findFirst({
      where: { customer_id: customerId }
    });
    
    if (!cart) {
      cart = await prisma.carts.create({
        data: {
          id: uuidv4(),
          customer_id: customerId,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    }
    
    let addedItems = [];
    for (const item of order.orderLineItems) {
      try {
        await prisma.cartItem.create({
          data: {
            id: uuidv4(),
            cart_id: cart.id,
            productId: item.productId,
            title: item.productName,
            unit_price: parseFloat(item.price),
            quantity: item.quantity,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        addedItems.push(item.productName);
      } catch (error) {
        console.log(`[Agent] Could not add ${item.productName} to cart:`, error.message);
      }
    }
    
    return `Great! I've added ${addedItems.length} items from order #${orderNumber} to your cart: ${addedItems.join(', ')}. Use "show my cart" to review your items.`;
    
  } catch (error) {
    console.error('[Agent] Reorder error:', error);
    return "I'm having trouble processing that reorder. Please try again or add items manually.";
  }
}

async handleClearCart(customerId) {
  try {
    const cart = await prisma.carts.findFirst({
      where: { customer_id: customerId }
    });

    if (!cart) {
      return "Your cart is already empty.";
    }

    // Delete all cart items
    await prisma.cartItem.deleteMany({
      where: { cart_id: cart.id }
    });

    return "Your cart has been cleared successfully! Ready to add some fresh items?";

  } catch (error) {
    console.error('[Agent] Clear cart error:', error);
    return "I'm having trouble clearing your cart. Please try again.";
  }
}

// FR06: Customer Information Queries
/*async handleCustomerInfoQuery(message) {
  try {
    // Extract order number if present
    const orderIdMatch = message.match(/\b(\d{3,})\b/);
    
    if (!orderIdMatch) {
      return "Please specify an order number to get customer information. For example: 'Give me customer info for order 12345'";
    }
    
    const orderId = orderIdMatch[1];
    
    // Find order with customer details
    const order = await prisma.order.findFirst({
      where: { orderNumber: parseInt(orderId) },
      include: { customer: true }
    });
    
    if (!order) {
      return `I couldn't find order #${orderId}. Please check the order number and try again.`;
    }
    
    if (!order.customer) {
      return `Order #${orderId} exists but no customer information is available.`;
    }
    
    const customer = order.customer;
    
    // Build response based on what user asked for
    const lowerMessage = message.toLowerCase();
    let response = `Customer information for order #${orderId}:\n\n`;
    
    if (lowerMessage.includes('email') || lowerMessage.includes('contact')) {
      response += `Email: ${customer.email || 'Not provided'}\n`;
    }
    
    if (lowerMessage.includes('phone') || lowerMessage.includes('contact')) {
      response += `Phone: ${customer.phone || 'Not provided'}\n`;
    }
    
    if (lowerMessage.includes('address')) {
      const address = [
        customer.line1,
        customer.line2,
        customer.city,
        customer.state,
        customer.postalCode,
        customer.country
      ].filter(Boolean).join(', ');
      
      response += `Address: ${address || 'Not provided'}\n`;
    }
    
    if (lowerMessage.includes('name')) {
      response += `Name: ${customer.name || 'Not provided'}\n`;
    }
    
    // If no specific field requested, show all
    if (!lowerMessage.includes('email') && !lowerMessage.includes('phone') && 
        !lowerMessage.includes('address') && !lowerMessage.includes('name')) {
      response += `Name: ${customer.name || 'Not provided'}\n`;
      response += `Email: ${customer.email || 'Not provided'}\n`;
      response += `Phone: ${customer.phone || 'Not provided'}\n`;
      
      const address = [
        customer.line1,
        customer.line2,
        customer.city,
        customer.state,
        customer.postalCode,
        customer.country
      ].filter(Boolean).join(', ');
      
      response += `Address: ${address || 'Not provided'}`;
    }
    
    return response;
    
  } catch (error) {
    console.error('[Agent] Customer info query error:', error);
    return "I'm having trouble accessing customer information right now. Please try again.";
  }
} */
  async handleCouponVerification(message) {
  try {
    // Extract order number
    const orderIdMatch = message.match(/\b(\d{3,})\b/);
    
    if (!orderIdMatch) {
      return "Please specify an order number to check coupon usage. For example: 'Was a coupon used on order 12345?'";
    }
    
    const orderId = orderIdMatch[1];
    
    // Find order
    const order = await prisma.order.findFirst({
      where: { orderNumber: parseInt(orderId) }
    });
    
    if (!order) {
      return `I couldn't find order #${orderId}. Please check the order number and try again.`;
    }
    
    if (!order.couponId) {
      return `No coupon was used on order #${orderId}.`;
    }
    
    // Get coupon details
    const coupon = await prisma.coupon.findFirst({
      where: { id: order.couponId }
    });
    
    if (!coupon) {
      return `Order #${orderId} had a coupon applied, but I couldn't find the coupon details.`;
    }
    
    const couponValue = coupon.value || 0;
    const couponType = coupon.type || 'amount';
    const couponName = coupon.name || coupon.id;
    
    let response = `Yes, a coupon was used on order #${orderId}:\n\n`;
    response += `Coupon: ${couponName}\n`;
    
    if (couponType === 'percent') {
      response += `Discount: ${couponValue}% off`;
    } else {
      response += `Discount: $${couponValue} off`;
    }
    
    return response;
    
  } catch (error) {
    console.error('[Agent] Coupon verification error:', error);
    return "I'm having trouble checking coupon information. Please try again.";
  }
}

// FR05: Special Instructions
async handleSpecialInstructions(message) {
  try {
    // Extract order number
    const orderIdMatch = message.match(/\b(\d{3,})\b/);
    
    if (!orderIdMatch) {
      return "Please specify an order number to check special instructions. For example: 'Any special instructions for order 12345?'";
    }
    
    const orderId = orderIdMatch[1];
    
    // Find order with line items
    const order = await prisma.order.findFirst({
      where: { orderNumber: parseInt(orderId) },
      include: { orderLineItems: true }
    });
    
    if (!order) {
      return `I couldn't find order #${orderId}. Please check the order number and try again.`;
    }
    
    // Check for special instructions in line items
    const itemsWithInstructions = order.orderLineItems.filter(item => 
      item.specialInstructions && item.specialInstructions.trim() !== ''
    );
    
    if (itemsWithInstructions.length === 0) {
      return `No special instructions were provided for order #${orderId}.`;
    }
    
    let response = `Special instructions for order #${orderId}:\n\n`;
    
    itemsWithInstructions.forEach(item => {
      response += `• ${item.productName || 'Item'}: ${item.specialInstructions}\n`;
    });
    
    return response;
    
  } catch (error) {
    console.error('[Agent] Special instructions error:', error);
    return "I'm having trouble accessing special instructions. Please try again.";
  }
}

// FR08: Search by Customer Data
async handleCustomerSearch(message) {
  try {
    // Extract email or phone
    const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const phoneMatch = message.match(/(\+?[\d\s\-\(\)]{10,})/);
    
    let searchCriteria = null;
    let searchValue = null;
    
    if (emailMatch) {
      searchCriteria = 'email';
      searchValue = emailMatch[1];
    } else if (phoneMatch) {
      searchCriteria = 'phone';
      searchValue = phoneMatch[1].replace(/[\s\-\(\)]/g, ''); // Clean phone number
    } else {
      return "Please provide an email address or phone number to search for customer orders. For example: 'Find latest order for neha.t@cogentibs.in'";
    }
    
    // Find customer
    const customer = await prisma.customer.findFirst({
      where: searchCriteria === 'email' 
        ? { email: searchValue }
        : { phone: { contains: searchValue } }
    });
    
    if (!customer) {
      return `I couldn't find a customer with ${searchCriteria}: ${searchValue}`;
    }
    
    // Get latest orders for this customer
    const orders = await prisma.order.findMany({
      where: { customerId: customer.phone },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { orderLineItems: true }
    });
    
    if (orders.length === 0) {
      return `Customer ${customer.name || searchValue} has no orders.`;
    }
    
    let response = `Latest orders for ${customer.name || 'customer'} (${searchValue}):\n\n`;
    
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt).toLocaleDateString();
      const itemCount = order.orderLineItems?.length || 0;
      
      response += `• Order #${order.orderNumber} - $${order.amount || '0'} (${orderDate}) - ${itemCount} items\n`;
    });
    
    return response;
    
  } catch (error) {
    console.error('[Agent] Customer search error:', error);
    return "I'm having trouble searching customer orders. Please try again.";
  }
}

// Provisional Order Support
async handleProvisionalOrderTracking(message) {
  try {
    // Extract provisional order number
    const orderIdMatch = message.match(/\b(\d{3,})\b/);
    
    if (!orderIdMatch) {
      return "Please provide a provisional order number to track.";
    }
    
    const provisionalId = orderIdMatch[1];
    
    // Search by provisional order number
    const order = await prisma.order.findFirst({
      where: { orderNumberProvisional: parseInt(provisionalId) },
      include: { orderLineItems: true }
    });
    
    if (!order) {
      return `I couldn't find provisional order #${provisionalId}. Please check the number and try again.`;
    }
    
    const status = order.status || 'Processing';
    const amount = order.amount || '0';
    const createdDate = new Date(order.createdAt).toLocaleDateString();
    
    let response = `Provisional Order #${provisionalId} Status:\n\n`;
    response += `Status: ${status}\n`;
    response += `Amount: $${amount}\n`;
    response += `Order Date: ${createdDate}\n`;
    
    if (order.orderNumber) {
      response += `\nThis order has been confirmed as Order #${order.orderNumber}`;
    }
    
    return response;
    
  } catch (error) {
    console.error('[Agent] Provisional order tracking error:', error);
    return "I'm having trouble tracking that provisional order. Please try again.";
  }
}

  async handleRecommendations(customerId) {
    try {
      // Get personalized recommendations based on order history
      const recommendations = await this.getPersonalizedRecommendations(customerId);
      
      if (recommendations.length > 0) {
        const response = "Based on your preferences, you might like:\n\n" + 
          recommendations.map(item => `• ${item.name} - $${item.price}`).join('\n');
        
        return {
          response,
          products: recommendations
        };
      } else {
        // Fallback to popular items
        try {
          const popularItems = await prisma.product.findMany({
            where: { is_available: true },
            take: 5,
            orderBy: { name: 'asc' }
          });

          const response = "Here are our popular items!\n\n" + 
            popularItems.map(item => `• ${item.name} - $${item.price}`).join('\n');

          return {
            response,
            products: popularItems.map(p => ({ 
              id: p.id, 
              name: p.name, 
              price: p.price,
              description: p.description
            }))
          };
        } catch (dbError) {
          // Hardcoded fallback for reliability
          const fallbackProducts = [
            { id: 'fallback-1', name: 'Chicken Biryani', price: 12.99, description: 'Aromatic rice with spiced chicken' },
            { id: 'fallback-2', name: 'Butter Chicken', price: 11.99, description: 'Creamy tomato-based curry' },
            { id: 'fallback-3', name: 'Lamb Curry', price: 13.99, description: 'Tender lamb in rich spices' },
            { id: 'fallback-4', name: 'Garlic Naan', price: 2.99, description: 'Fresh bread with garlic' },
            { id: 'fallback-5', name: 'Vegetable Samosa (2pcs)', price: 4.99, description: 'Crispy pastry with spiced vegetables' }
          ];

          return {
            response: "Here are our popular items!\n\n" + 
              fallbackProducts.map(item => `• ${item.name} - $${item.price}`).join('\n'),
            products: fallbackProducts
          };
        }
      }
    } catch (error) {
      console.error('[Agent] Recommendation error:', error);
      
      // Hardcoded fallback for reliability
      const fallbackProducts = [
        { id: 'fallback-1', name: 'Chicken Biryani', price: 12.99, description: 'Aromatic rice with spiced chicken' },
        { id: 'fallback-2', name: 'Butter Chicken', price: 11.99, description: 'Creamy tomato-based curry' },
        { id: 'fallback-3', name: 'Lamb Curry', price: 13.99, description: 'Tender lamb in rich spices' },
        { id: 'fallback-4', name: 'Garlic Naan', price: 2.99, description: 'Fresh bread with garlic' },
        { id: 'fallback-5', name: 'Vegetable Samosa (2pcs)', price: 4.99, description: 'Crispy pastry with spiced vegetables' }
      ];

      return {
        response: "Here are our popular items!\n\n" + 
          fallbackProducts.map(item => `• ${item.name} - $${item.price}`).join('\n'),
        products: fallbackProducts
      };
    }
  }

  async getPersonalizedRecommendations(customerId) {
    try {
      let orderHistory = [];
      
      try {
        orderHistory = await prisma.order.findMany({
          where: { customer_id: customerId },
          include: {
            order_items: {
              include: {
                product: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          take: 10
        });
      } catch (error) {
        try {
          orderHistory = await prisma.order.findMany({
            where: { customerId: customerId },
            include: {
              orderLineItems: true
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          });
        } catch (fallbackError) {
          return [];
        }
      }

      if (orderHistory.length === 0) {
        return [];
      }

      // Count product frequency
      const productFrequency = {};
      orderHistory.forEach(order => {
        if (order.order_items) {
          order.order_items.forEach(item => {
            const productName = item.product?.name || 'Unknown';
            productFrequency[productName] = (productFrequency[productName] || 0) + 1;
          });
        } else if (order.orderLineItems) {
          order.orderLineItems.forEach(item => {
            productFrequency[item.productName] = (productFrequency[item.productName] || 0) + 1;
          });
        }
      });

      // Get top products
      const topProducts = Object.entries(productFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([name]) => name);

      // Find similar products from database
      const recommendations = await prisma.product.findMany({
        where: {
          OR: topProducts.map(name => ({
            name: { contains: name.split(' ')[0], mode: 'insensitive' }
          }))
        },
        take: 5
      });

      return recommendations.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description
      }));

    } catch (error) {
      console.error('[Agent] Personalization error:', error);
      return [];
    }
  }

  async handlePreferenceLearning(customerId, message) {
    try {
      const preferences = this.extractPreferences(message);
      
      if (preferences.length > 0) {
        const storedPrefs = [];
        
        for (const pref of preferences) {
          try {
            try {
              await prisma.customer_preferences.upsert({
                where: {
                  customer_id_key: {
                    customer_id: customerId,
                    key: pref
                  }
                },
                update: {
                  weight: 1.0,
                  updated_at: new Date()
                },
                create: {
                  customer_id: customerId,
                  key: pref,
                  weight: 1.0,
                  created_at: new Date(),
                  updated_at: new Date()
                }
              });
              storedPrefs.push(pref);
            } catch (error1) {
              try {
                await prisma.customerPreferences.upsert({
                  where: {
                    customer_id_key: {
                      customer_id: customerId,
                      key: pref
                    }
                  },
                  update: {
                    weight: 1.0,
                    updatedAt: new Date()
                  },
                  create: {
                    id: uuidv4(),
                    customer_id: customerId,
                    key: pref,
                    weight: 1.0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  }
                });
                storedPrefs.push(pref);
              } catch (error2) {
                if (DEBUG) console.log(`[Agent] Could not store preference ${pref}:`, error2.message);
              }
            }
          } catch (error) {
            if (DEBUG) console.log(`[Agent] Failed to store preference ${pref}:`, error.message);
          }
        }

        const prefString = storedPrefs.length > 0 ? storedPrefs.join(', ') : preferences.join(', ');
        return `Thanks for letting me know your preferences! I've noted that you like: ${prefString}. I'll use this information to give you better recommendations in the future!`;
      } else {
        return "I'd love to learn about your preferences! Tell me what kinds of food you enjoy - like spicy, mild, vegetarian, biryani, curry, etc.";
      }
    } catch (error) {
      console.error('Preference learning error:', error);
      return "I've noted your preferences and will use them for better recommendations!";
    }
  }

  extractPreferences(message) {
    const preferences = [];
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('spicy') || lowerMessage.includes('hot')) preferences.push('spicy');
    if (lowerMessage.includes('biryani')) preferences.push('biryani');
    if (lowerMessage.includes('mild') || lowerMessage.includes('not spicy')) preferences.push('mild');
    if (lowerMessage.includes('sweet')) preferences.push('sweet');
    if (lowerMessage.includes('curry')) preferences.push('curry');
    if (lowerMessage.includes('vegetarian') || lowerMessage.includes('veggie')) preferences.push('vegetarian');
    if (lowerMessage.includes('vegan')) preferences.push('vegan');
    if (lowerMessage.includes('chicken')) preferences.push('chicken');
    if (lowerMessage.includes('lamb') || lowerMessage.includes('mutton')) preferences.push('lamb');
    if (lowerMessage.includes('beef')) preferences.push('beef');
    if (lowerMessage.includes('rice')) preferences.push('rice');
    if (lowerMessage.includes('naan') || lowerMessage.includes('bread')) preferences.push('bread');
    
    return preferences;
  }

  async handleSearch(message) {
    try {
      const products = await this.searchProducts(message);
      
      if (products.length > 0) {
        const response = `` 
        
        return { response, products };
      } else {
        return {
          response: `I couldn't find any items matching "${message}". Try searching for something else like "chicken", "biryani", "curry", "vegetarian", or "samosa".`,
          products: []
        };
      }
    } catch (error) {
      console.error('[Agent] Search error:', error);
      return {
        response: "I'm having trouble searching right now. Please try again or ask me for recommendations!",
        products: []
      };
    }
  }

  async searchProducts(query) {
    try {
      // Try vector search first
      const vectorResults = await searchSimilar(query, 5, 'product');
      if (vectorResults && vectorResults.length > 0) {
        return vectorResults;
      }
    } catch (error) {
      if (DEBUG) console.log('[Agent] Vector search failed, using text search');
    }

    // Enhanced fallback to text search
    try {
      const textResults = await prisma.product.findMany({
        where: {
          AND: [
            { is_available: true },
            {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { category: { contains: query, mode: 'insensitive' } }
              ]
            }
          ]
        },
        take: 5
      });

      // If no results, try broader search
      if (textResults.length === 0) {
        const broaderResults = await prisma.product.findMany({
          where: {
            is_available: true
          },
          take: 5
        });
        
        return broaderResults.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          description: p.description,
          category: p.category
        }));
      }

      return textResults.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        category: p.category
      }));
    } catch (error) {
      console.error('[Agent] Text search error:', error);
      // Return some hardcoded products as absolute fallback
      return [
        { id: 'biryani-1', name: 'Chicken Biryani', price: 12.99, description: 'Aromatic rice with spiced chicken' },
        { id: 'curry-1', name: 'Butter Chicken', price: 11.99, description: 'Creamy tomato-based curry' },
        { id: 'samosa-1', name: 'Vegetable Samosa (2pcs)', price: 4.99, description: 'Crispy pastry with spiced vegetables' }
      ];
    }
  }

  async handleAddToCart(customerId, sessionId, message) {
    try {
      const productName = this.extractProductFromMessage(message);
      
      if (!productName) {
        return "I couldn't identify which item you want to add. Please specify the item name, like 'Add chicken biryani to my cart'.";
      }

      // Find the product in database
      const product = await prisma.product.findFirst({
        where: {
          name: { contains: productName, mode: 'insensitive' }
        }
      });

      if (!product) {
        return `I couldn't find "${productName}" in our menu. Try searching for it first to see available items, or ask me for recommendations!`;
      }

      try {
        // First, find or create a cart for this customer
        let cart = await prisma.carts.findFirst({
          where: { customer_id: customerId }
        });

        if (!cart) {
          // Create a new cart for the customer
          cart = await prisma.carts.create({
            data: {
              id: uuidv4(),
              customer_id: customerId,
              created_at: new Date(),
              updated_at: new Date()
            }
          });
        }

        // Check if item already exists in cart using cart_id
        const existingItem = await prisma.cartItem.findFirst({
          where: {
            cart_id: cart.id,
            productId: product.id
          }
        });

        if (existingItem) {
          // Update quantity
          const updatedItem = await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { 
              quantity: existingItem.quantity + 1,
              updated_at: new Date()
            }
          });
          
          const totalPrice = (parseFloat(existingItem.unit_price || product.price) * updatedItem.quantity).toFixed(2);
          
          return `I've increased the quantity of "${product.name}" in your cart! You now have ${updatedItem.quantity} items. (${totalPrice}) Use "show my cart" to view all items.`;
        } else {
          // Add new item to cart
          const cartItem = await prisma.cartItem.create({
            data: {
              id: uuidv4(),
              cart_id: cart.id,
              productId: product.id,
              title: product.name,
              unit_price: parseFloat(product.price),
              quantity: 1,
              created_at: new Date(),
              updated_at: new Date()
            }
          });

          return `I've added "${product.name}" to your cart! (${product.price}) Use "show my cart" to view all items.`;
        }
      } catch (dbError) {
        console.log('[Agent] Database cart failed, using memory:', dbError.message);
        
        // Fallback to in-memory cart
        if (!this.sessionMemory.has(sessionId)) {
          this.sessionMemory.set(sessionId, { cart: [] });
        }
        
        const sessionData = this.sessionMemory.get(sessionId);
        const existingItemIndex = sessionData.cart.findIndex(item => item.productId === product.id);
        
        if (existingItemIndex >= 0) {
          sessionData.cart[existingItemIndex].quantity += 1;
          const quantity = sessionData.cart[existingItemIndex].quantity;
          return `I've increased the quantity of "${product.name}" in your cart! You now have ${quantity} items. (${(parseFloat(product.price) * quantity).toFixed(2)}) (Note: Using temporary cart)`;
        } else {
          sessionData.cart.push({
            productId: product.id,
            name: product.name,
            price: parseFloat(product.price),
            quantity: 1,
            addedAt: new Date()
          });
          return `I've added "${product.name}" to your cart! (${product.price}) (Note: Using temporary cart)`;
        }
      }

    } catch (error) {
      console.error('Add to cart error:', error);
      return "I'm having trouble with the cart system right now. Please try again or let me know if you'd like to place an order directly.";
    }
  }

  // In agentService.js - Replace the handleViewCart method
// In agentService.js - Make sure your handleViewCart returns an object:
async handleViewCart(customerId) {
  try {
    const cart = await prisma.carts.findFirst({
      where: { customer_id: customerId }
    });

    if (!cart) {
      return "Your cart is empty. Would you like to see our menu or get some recommendations?";
    }

    const cartItems = await prisma.cartItem.findMany({
      where: { cart_id: cart.id },
      include: { products: true }
    });

    if (cartItems.length === 0) {
      return "Your cart is empty. Would you like to see our menu or get some recommendations?";
    }

    const total = cartItems.reduce((sum, item) => {
      return sum + (parseFloat(item.unit_price || 0) * item.quantity);
    }, 0);

    // IMPORTANT: Return object structure, not just text
    return {
      text: `Your Cart:`,
      type: 'cart_display',
      cartItems: cartItems.map(item => ({
        id: item.id,
        productId: item.productId,
        name: item.title,
        price: parseFloat(item.unit_price || 0),
        quantity: item.quantity,
        total: parseFloat(item.unit_price || 0) * item.quantity
      })),
      cartTotal: parseFloat(total.toFixed(2))
    };

  } catch (error) {
    console.error('View cart error:', error);
    return "Your cart is empty. Would you like to see our menu?";
  }
}

// Add new methods for handling quantity changes
async handleUpdateCartQuantity(customerId, productId, action) {
  try {
    // Find the cart for this customer
    const cart = await prisma.carts.findFirst({
      where: { customer_id: customerId }
    });

    if (!cart) {
      return "Your cart is empty.";
    }

    // Find the cart item
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        cart_id: cart.id,
        productId: productId
      },
      include: { products: true }
    });

    if (!cartItem) {
      return "Item not found in your cart.";
    }

    if (action === 'increase') {
      // Increase quantity
      await prisma.cartItem.update({
        where: { id: cartItem.id },
        data: { 
          quantity: cartItem.quantity + 1,
          updated_at: new Date()
        }
      });
      
      const newTotal = (parseFloat(cartItem.unit_price) * (cartItem.quantity + 1)).toFixed(2);
      return `Increased ${cartItem.title} quantity to ${cartItem.quantity + 1}. Item total: $${newTotal}`;
      
    } else if (action === 'decrease') {
      if (cartItem.quantity > 1) {
        // Decrease quantity
        await prisma.cartItem.update({
          where: { id: cartItem.id },
          data: { 
            quantity: cartItem.quantity - 1,
            updated_at: new Date()
          }
        });
        
        const newTotal = (parseFloat(cartItem.unit_price) * (cartItem.quantity - 1)).toFixed(2);
        return `Decreased ${cartItem.title} quantity to ${cartItem.quantity - 1}. Item total: $${newTotal}`;
        
      } else {
        // Remove item if quantity would be 0
        await prisma.cartItem.delete({
          where: { id: cartItem.id }
        });
        
        return `Removed ${cartItem.title} from your cart.`;
      }
    }

  } catch (error) {
    console.error('[Agent] Update cart quantity error:', error);
    return "I'm having trouble updating your cart. Please try again.";
  }
}

async handleRemoveFromCart(customerId, productId) {
  try {
    // Find the cart for this customer
    const cart = await prisma.carts.findFirst({
      where: { customer_id: customerId }
    });

    if (!cart) {
      return "Your cart is empty.";
    }

    // Find and remove the cart item
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        cart_id: cart.id,
        productId: productId
      }
    });

    if (!cartItem) {
      return "Item not found in your cart.";
    }

    await prisma.cartItem.delete({
      where: { id: cartItem.id }
    });

    return `Removed ${cartItem.title} from your cart.`;

  } catch (error) {
    console.error('[Agent] Remove from cart error:', error);
    return "I'm having trouble removing that item. Please try again.";
  }
}

async handleViewCoupons() {
  try {
    console.log('[Agent] Fetching available coupons');
    
    const coupons = await prisma.coupon.findMany({
      orderBy: { value: 'desc' },
      take: 10
    });

    if (coupons.length === 0) {
      return "Sorry, there are no active coupons available right now. But we have great deals on our delicious food! Would you like to see our menu or get some recommendations?";
    }

    let response = "Here are our current available coupons:\n\n";
    
    coupons.forEach(coupon => {
      const couponName = coupon.name || coupon.id;
      const couponValue = coupon.value || 0;
      const couponType = coupon.type || 'amount';
      
      if (couponType === 'percent') {
        response += `• ${couponName} - ${couponValue}% off\n`;
      } else if (couponType === 'amount') {
        response += `• ${couponName} - $${couponValue} off\n`;
      } else {
        response += `• ${couponName} - ${couponValue}\n`;
      }
    });
    
    response += "\nTo use a coupon, just mention the coupon code when you're ready to checkout!";
    
    return response;

  } catch (error) {
    console.error('[Agent] Error fetching coupons:', error);
    return "I'm having trouble accessing our current coupon offers. Please try again in a moment, or would you like to see our menu instead?";
  }
}

  extractProductFromMessage(message) {
    const lowerMessage = message.toLowerCase();
    
    // More comprehensive product extraction
    if (lowerMessage.includes('chicken biryani')) return 'Chicken Biryani';
    if (lowerMessage.includes('lamb biryani')) return 'Lamb Biryani';
    if (lowerMessage.includes('biryani')) return 'Chicken Biryani';
    
    if (lowerMessage.includes('butter chicken')) return 'Butter Chicken';
    if (lowerMessage.includes('chicken curry')) return 'Butter Chicken';
    
    if (lowerMessage.includes('lamb curry')) return 'Lamb Curry';
    
    if (lowerMessage.includes('vegetable samosa') || lowerMessage.includes('veggie samosa')) return 'Vegetable Samosa';
    if (lowerMessage.includes('chicken samosa')) return 'Chicken Samosa';
    if (lowerMessage.includes('samosa')) return 'Vegetable Samosa';
    
    if (lowerMessage.includes('garlic naan')) return 'Garlic Naan';
    if (lowerMessage.includes('naan')) return 'Garlic Naan';
    
    if (lowerMessage.includes('tandoori chicken')) return 'Tandoori Chicken';
    if (lowerMessage.includes('chicken tikka')) return 'Chicken Tikka';
    
    // Extract quoted or capitalized product names
    const quotedMatch = message.match(/["']([^"']+)["']/);
    if (quotedMatch) return quotedMatch[1];
    
    return null;
  }


  async logInteraction(customerPhone, sessionId, message, intent = null, entities = null, response = null, productsShown = []) {
    try {
      if (DEBUG) {
        console.log(`[Agent] Would log interaction for ${customerPhone}: ${intent || 'unknown'}`);
      }
    } catch (error) {
      if (DEBUG) console.log(`[Agent] Logging skipped:`, error.message);
    }
  }
}

module.exports = AgentService;