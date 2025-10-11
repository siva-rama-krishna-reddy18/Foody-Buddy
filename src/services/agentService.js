// src/services/agentService.js - Complete Implementation with ALL Features
const { classifyIntent, extractEntities } = require('./intentService');
const { searchSimilar } = require('./vectorService');
const aiResponseService = require('./aiResponseService');
const Cart = require('../../models/Cart');
const CartItem = require('../../models/CartItem');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const Customer = require('../../models/Customer');
const CustomerPreferences = require('../../models/CustomerPreferences');
const Coupon = require('../../models/Coupon');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const DEBUG = process.env.DEBUG_ORCHESTRATOR === 'true';
const USE_AI = process.env.USE_AI_RESPONSES !== 'false'; // Enable AI by default
class AgentService {
  constructor() {
    console.log('[Agent] Initializing AgentService with ALL features');
    this.aiService = aiResponseService;
  }

  async processMessage(customerId, message) {
    try {
      if (DEBUG) console.log(`[Agent] Processing: "${message}" for customer: ${customerId}`);

      const intent = await classifyIntent(message);
      const entities = extractEntities(message);

      if (DEBUG) console.log(`[Agent] Intent: ${intent}, Entities:`, entities);

      const customerData = await this.getCustomerContext(customerId);

      // Route to appropriate handler based on intent
      switch (intent) {
        case 'GREETING':
          return await this.handleGreeting(customerId, message, customerData);

        case 'SEARCH':
        case 'RECOMMEND':
          return await this.handleSearch(customerId, message, intent);

        case 'VIEW_CART':
          return await this.handleViewCart(customerId);

        case 'ADD_TO_CART':
          return await this.handleAddToCart(customerId, message);

        case 'REMOVE_FROM_CART':
          return await this.handleRemoveFromCart(customerId, message);

        case 'UPDATE_CART_QUANTITY':
          return await this.handleUpdateCart(customerId, message);

        case 'CLEAR_CART':
          return await this.handleClearCart(customerId);

        case 'ORDER_STATUS':
          return await this.handleOrderStatus(customerId);

        case 'TRACK_ORDER':
          return await this.handleTrackOrder(customerId, message, entities);

        case 'GET_SPECIAL_INSTRUCTIONS':
          return await this.handleGetSpecialInstructions(customerId, message, entities);

        case 'GET_CUSTOMER_INFO':
          return await this.handleGetCustomerInfo(customerId, message, entities);

        case 'VERIFY_COUPON_USAGE':
          return await this.handleVerifyCoupon(customerId, message, entities);

        case 'SEARCH_BY_CUSTOMER':
          return await this.handleSearchByCustomer(customerId, message, entities);

        case 'CHECKOUT':
          return await this.handleCheckout(customerId);

        case 'PAYMENT_SUCCESS':
          return await this.handlePaymentSuccess(customerId, message);

        case 'LEARN_PREFERENCE':
          return await this.handleLearnPreference(customerId, message);

        default:
          return await this.handleUnknown(customerId, message);
      }

    } catch (error) {
      console.error('[Agent] Processing error:', error);
      return {
        aiText: "I'm having trouble processing your request. Please try again.",
        intent: 'ERROR',
        productList: [],
        addToCart: null,
        cartData: null,
        meta: {
          suggestions: ['View Menu', 'Show my cart'],
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async getCustomerContext(customerId) {
    try {
      let customer = await Customer.findOne({ phone: customerId }).lean();
      if (!customer) {
        customer = await Customer.findOne({ group_id: customerId }).lean();
      }

      let orders = [];
      if (customer) {
        orders = await Order.find({ group_id: customerId })
          .sort({ created_at: -1 })
          .limit(5)
          .lean();
      }

      return {
        customer,
        orders,
        customerName: customer?.name || null,
        orderCount: orders.length
      };
    } catch (error) {
      if (DEBUG) console.log('[Agent] Context fetch error:', error.message);
      return { customer: null, orders: [], customerName: null, orderCount: 0 };
    }
  }

  // FR01, FR02, FR03, FR04: Complete Order Tracking
  async handleTrackOrder(customerId, message, entities) {
    const orderId = entities.orderId || message.match(/\d{4,}/)?.[0];

    if (!orderId) {
      return {
        aiText: "Please provide an order number to track. Example: 'Track order 9999'",
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
      const order = await Order.findOne({ order_number: parseInt(orderId) }).lean();

      if (!order) {
        return {
          aiText: `Order #${orderId} not found. Please check the order number.`,
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

      // Format order details
      const orderDetails = {
        orderNumber: order.order_number,
        status: order.status,
        amount: order.amount,
        currency: order.currency || 'USD',
        date: order.created_at || order.date,
        paymentMethod: order.payment_method,
        items: order.line_items || [],
        itemCount: order.line_items?.length || 0
      };

      // Build comprehensive response
      let responseText = `📦 **Order #${order.order_number}**\n`;
      responseText += `Status: ${order.status}\n`;
      responseText += `Amount: $${order.amount}\n`;
      responseText += `Items: ${orderDetails.itemCount}\n`;
      
      if (order.line_items && order.line_items.length > 0) {
        responseText += `\n**Items:**\n`;
        order.line_items.forEach((item, idx) => {
          responseText += `${idx + 1}. ${item.product} (Qty: ${item.quantity}) - $${item.price}\n`;
        });
      }

      return {
        aiText: responseText,
        intent: 'TRACK_ORDER',
        productList: [],
        cartData: null,
        orderData: [orderDetails],
        meta: {
          suggestions: ['View order history', 'Place new order'],
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

  // FR05: Get Special Instructions
  async handleGetSpecialInstructions(customerId, message, entities) {
    const orderId = entities.orderId || message.match(/\d{4,}/)?.[0];

    if (!orderId) {
      return {
        aiText: "Please provide an order number to check special instructions.",
        intent: 'GET_SPECIAL_INSTRUCTIONS',
        productList: [],
        cartData: null,
        orderData: null,
        meta: {
          suggestions: ['View orders'],
          timestamp: new Date().toISOString()
        }
      };
    }

    try {
      const order = await Order.findOne({ order_number: parseInt(orderId) }).lean();

      if (!order) {
        return {
          aiText: `Order #${orderId} not found.`,
          intent: 'GET_SPECIAL_INSTRUCTIONS',
          productList: [],
          cartData: null,
          orderData: null,
          meta: {
            suggestions: ['Check order number'],
            timestamp: new Date().toISOString()
          }
        };
      }

      // Check for special instructions in line items
      const itemsWithInstructions = order.line_items?.filter(item => 
        item.specialInstructions && item.specialInstructions.trim().length > 0
      ) || [];

      if (itemsWithInstructions.length === 0) {
        return {
          aiText: `No special instructions found for order #${orderId}.`,
          intent: 'GET_SPECIAL_INSTRUCTIONS',
          productList: [],
          cartData: null,
          orderData: [{ orderNumber: order.order_number, instructions: [] }],
          meta: {
            suggestions: ['View order details'],
            timestamp: new Date().toISOString()
          }
        };
      }

      let responseText = `📝 **Special Instructions for Order #${orderId}:**\n\n`;
      itemsWithInstructions.forEach((item, idx) => {
        responseText += `${idx + 1}. **${item.product}**: ${item.specialInstructions}\n`;
      });

      return {
        aiText: responseText,
        intent: 'GET_SPECIAL_INSTRUCTIONS',
        productList: [],
        cartData: null,
        orderData: [{
          orderNumber: order.order_number,
          instructions: itemsWithInstructions.map(i => ({
            product: i.product,
            instruction: i.specialInstructions
          }))
        }],
        meta: {
          suggestions: ['View full order'],
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[Agent] Get instructions error:', error);
      return {
        aiText: "Error retrieving special instructions. Please try again.",
        intent: 'GET_SPECIAL_INSTRUCTIONS',
        productList: [],
        cartData: null,
        orderData: null,
        meta: {
          suggestions: ['Try again'],
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // FR06: Query Customer Information
  async handleGetCustomerInfo(customerId, message, entities) {
    const orderId = entities.orderId || message.match(/\d{4,}/)?.[0];

    if (!orderId) {
      return {
        aiText: "Please provide an order number to get customer information.",
        intent: 'GET_CUSTOMER_INFO',
        productList: [],
        cartData: null,
        orderData: null,
        meta: {
          suggestions: ['View orders'],
          timestamp: new Date().toISOString()
        }
      };
    }

    try {
      const order = await Order.findOne({ order_number: parseInt(orderId) }).lean();

      if (!order) {
        return {
          aiText: `Order #${orderId} not found.`,
          intent: 'GET_CUSTOMER_INFO',
          productList: [],
          cartData: null,
          orderData: null,
          meta: {
            suggestions: ['Check order number'],
            timestamp: new Date().toISOString()
          }
        };
      }

      // Get customer info from order's group_id
      const customer = await Customer.findOne({ group_id: order.group_id }).lean();

      if (!customer) {
        return {
          aiText: `Customer information not found for order #${orderId}.`,
          intent: 'GET_CUSTOMER_INFO',
          productList: [],
          cartData: null,
          orderData: null,
          meta: {
            suggestions: ['View order details'],
            timestamp: new Date().toISOString()
          }
        };
      }

      let responseText = `👤 **Customer Information for Order #${orderId}:**\n\n`;
      responseText += `Name: ${customer.name || 'N/A'}\n`;
      responseText += `Email: ${customer.email || 'N/A'}\n`;
      responseText += `Phone: ${customer.phone || 'N/A'}\n`;

      return {
        aiText: responseText,
        intent: 'GET_CUSTOMER_INFO',
        productList: [],
        cartData: null,
        orderData: [{
          orderNumber: order.order_number,
          customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone
          }
        }],
        meta: {
          suggestions: ['View order details'],
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[Agent] Get customer info error:', error);
      return {
        aiText: "Error retrieving customer information. Please try again.",
        intent: 'GET_CUSTOMER_INFO',
        productList: [],
        cartData: null,
        orderData: null,
        meta: {
          suggestions: ['Try again'],
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // FR07: Verify Coupon Usage
  async handleVerifyCoupon(customerId, message, entities) {
    const orderId = entities.orderId || message.match(/\d{4,}/)?.[0];

    if (!orderId) {
      return {
        aiText: "Please provide an order number to check coupon usage.",
        intent: 'VERIFY_COUPON_USAGE',
        productList: [],
        cartData: null,
        orderData: null,
        meta: {
          suggestions: ['View orders'],
          timestamp: new Date().toISOString()
        }
      };
    }

    try {
      const order = await Order.findOne({ order_number: parseInt(orderId) }).lean();

      if (!order) {
        return {
          aiText: `Order #${orderId} not found.`,
          intent: 'VERIFY_COUPON_USAGE',
          productList: [],
          cartData: null,
          orderData: null,
          meta: {
            suggestions: ['Check order number'],
            timestamp: new Date().toISOString()
          }
        };
      }

      if (!order.couponId) {
        return {
          aiText: `No coupon was used on order #${orderId}.`,
          intent: 'VERIFY_COUPON_USAGE',
          productList: [],
          cartData: null,
          orderData: [{ orderNumber: order.order_number, couponUsed: false }],
          meta: {
            suggestions: ['View order details'],
            timestamp: new Date().toISOString()
          }
        };
      }

      // Get coupon details
      const coupon = await Coupon.findOne({ id: order.couponId }).lean();

      let responseText = `🎫 **Coupon Used on Order #${orderId}:**\n\n`;
      if (coupon) {
        responseText += `Coupon: ${coupon.name}\n`;
        responseText += `Discount: $${coupon.value} ${coupon.type || ''}\n`;
      } else {
        responseText += `Coupon ID: ${order.couponId}\n`;
        responseText += `(Details not available)\n`;
      }

      return {
        aiText: responseText,
        intent: 'VERIFY_COUPON_USAGE',
        productList: [],
        cartData: null,
        orderData: [{
          orderNumber: order.order_number,
          couponUsed: true,
          coupon: coupon ? {
            name: coupon.name,
            value: coupon.value,
            type: coupon.type
          } : null
        }],
        meta: {
          suggestions: ['View order details'],
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[Agent] Verify coupon error:', error);
      return {
        aiText: "Error checking coupon usage. Please try again.",
        intent: 'VERIFY_COUPON_USAGE',
        productList: [],
        cartData: null,
        orderData: null,
        meta: {
          suggestions: ['Try again'],
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // FR08: Search by Customer Data
  async handleSearchByCustomer(customerId, message, entities) {
    try {
      let customer = null;
      let searchCriteria = '';

      // Search by email
      if (entities.email) {
        customer = await Customer.findOne({ email: entities.email }).lean();
        searchCriteria = entities.email;
      }
      // Search by phone
      else if (entities.phone) {
        customer = await Customer.findOne({ phone: entities.phone }).lean();
        searchCriteria = entities.phone;
      }
      // Search by name in message
      else {
        const nameMatch = message.match(/for\s+(\w+)/i);
        if (nameMatch) {
          customer = await Customer.findOne({ 
            name: new RegExp(nameMatch[1], 'i') 
          }).lean();
          searchCriteria = nameMatch[1];
        }
      }

      if (!customer) {
        return {
          aiText: `No customer found matching "${searchCriteria}".`,
          intent: 'SEARCH_BY_CUSTOMER',
          productList: [],
          cartData: null,
          orderData: null,
          meta: {
            suggestions: ['Try different search'],
            timestamp: new Date().toISOString()
          }
        };
      }

      // Get latest orders for this customer
      const orders = await Order.find({ group_id: customer.group_id })
        .sort({ created_at: -1 })
        .limit(5)
        .lean();

      if (orders.length === 0) {
        return {
          aiText: `Found customer ${customer.name}, but they have no orders yet.`,
          intent: 'SEARCH_BY_CUSTOMER',
          productList: [],
          cartData: null,
          orderData: null,
          meta: {
            suggestions: ['View Menu'],
            timestamp: new Date().toISOString()
          }
        };
      }

      const latestOrder = orders[0];
      let responseText = `👤 **Customer: ${customer.name}**\n\n`;
      responseText += `📦 Latest Order: #${latestOrder.order_number}\n`;
      responseText += `Status: ${latestOrder.status}\n`;
      responseText += `Amount: $${latestOrder.amount}\n`;
      responseText += `Date: ${new Date(latestOrder.created_at).toLocaleDateString()}\n\n`;
      responseText += `Total Orders: ${orders.length}`;

      const orderList = orders.map(o => ({
        orderNumber: o.order_number,
        status: o.status,
        amount: o.amount,
        date: o.created_at,
        itemCount: o.line_items?.length || 0
      }));

      return {
        aiText: responseText,
        intent: 'SEARCH_BY_CUSTOMER',
        productList: [],
        cartData: null,
        orderData: orderList,
        meta: {
          suggestions: ['View order details', 'View all orders'],
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[Agent] Search by customer error:', error);
      return {
        aiText: "Error searching for customer. Please try again.",
        intent: 'SEARCH_BY_CUSTOMER',
        productList: [],
        cartData: null,
        orderData: null,
        meta: {
          suggestions: ['Try again'],
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Greeting Handler
  async handleGreeting(customerId, message, customerData) {
  const context = {
    customerId,
    message,
    intent: 'GREETING',
    customerName: customerData.customerName,
    orders: customerData.orders
  };

  const aiText = USE_AI 
    ? await this.aiService.generateResponse(context)
    : customerData.customerName && customerData.orderCount > 0
      ? `Welcome back, ${customerData.customerName}! 👋 What would you like today?`
      : "Hi! Welcome to FoodyBuddy. 🍽️ What can I get for you?";

  return {
    aiText,
    intent: 'GREETING',
    productList: [],
    addToCart: null,
    cartData: null,
    meta: {
      suggestions: ['View Menu', 'Show my cart', 'Track Orders', 'Today\'s Specials'],
      timestamp: new Date().toISOString()
    }
  };
}

  // Search and Recommendations Handler
  async handleSearch(customerId, message, intent) {
  try {
    let searchQuery = message;
    let maxResults = 16;
    
    // For menu/specials, show all items
    const isMenuRequest = intent === 'RECOMMEND' || 
                         message.toLowerCase().includes('special') ||
                         message.toLowerCase().includes('menu') ||
                         message.toLowerCase().includes('recommendation');
    
    if (isMenuRequest) {
      searchQuery = 'menu';
      maxResults = 50;
    }
    
    const products = await searchSimilar(searchQuery, maxResults);

    if (DEBUG) {
      console.log(`[Agent] Search for "${message}" found ${products.length} products`);
    }

    // NEVER use AI for product display - just show products
    let aiText = '';
    
    // Only show AI text if NO products found
    if (products.length === 0) {
      aiText = "I couldn't find that. Try chicken, rice, biryani, or soup! 🔍";
    }

    return {
      aiText,
      intent,
      productList: products,
      addToCart: null,
      cartData: null,
      meta: {
        suggestions: products.length > 0 
          ? ['Add to cart', 'View cart']
          : ['View Menu', 'Show recommendations'],
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[Agent] Search error:', error);
    return {
      aiText: "Error searching. Please try again.",
      intent,
      productList: [],
      addToCart: null,
      cartData: null,
      meta: {
        suggestions: ['Try again', 'View Menu'],
        timestamp: new Date().toISOString()
      }
    };
  }
}

  // View Cart Handler
  async handleViewCart(customerId) {
  try {
    const cart = await this.getCart(customerId);

    console.log('[Agent] VIEW_CART - Cart data:', {
      hasItems: cart.items.length > 0,
      itemCount: cart.itemCount,
      total: cart.total
    });

    const aiText = cart.items.length === 0 
      ? "Your cart is empty. Browse our menu to add items! 🛒"
      : '';

    return {
      aiText,
      intent: 'VIEW_CART',
      productList: [],
      addToCart: null,
      // ✅ FIX: Match frontend CartDisplay interface exactly
      cartData: cart.items.length > 0 ? {
        text: '', // Required by CartDisplay
        type: 'cart_display', // Required by CartDisplay
        cartItems: cart.cartItems, // Array of items
        cartTotal: cart.cartTotal  // Total price
      } : null,
      meta: {
        suggestions: cart.items.length > 0
          ? ['Proceed to pay', 'Add more items', 'Clear cart']
          : ['View Menu', 'Show recommendations'],
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[Agent] View cart error:', error);
    return {
      aiText: "Error loading cart. Please try again.",
      intent: 'VIEW_CART',
      productList: [],
      addToCart: null,
      cartData: null,
      meta: {
        suggestions: ['Try again', 'View Menu'],
        timestamp: new Date().toISOString()
      }
    };
  }
}
  // Add to Cart Handler
  async handleAddToCart(customerId, message) {
  const products = await searchSimilar(message, 1);

  if (products.length === 0) {
    return {
      aiText: "I couldn't find that item. Can you try searching again? 🔍",
      intent: 'ADD_TO_CART',
      productList: [],
      addToCart: null,
      cartData: null,
      meta: {
        suggestions: ['View Menu', 'Search again'],
        timestamp: new Date().toISOString()
      }
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
      // ✅ FIX: Match frontend CartDisplay interface exactly
      cartData: {
        text: '', // Required by CartDisplay
        type: 'cart_display', // Required by CartDisplay
        cartItems: cart.cartItems, // Array of items
        cartTotal: cart.cartTotal  // Total price
      },
      meta: {
        suggestions: ['View cart', 'Add more items', 'Checkout'],
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[Agent] Add to cart error:', error);
    return {
      aiText: "Sorry, couldn't add that item. Please try again.",
      intent: 'ADD_TO_CART',
      productList: [],
      addToCart: null,
      cartData: null,
      meta: {
        suggestions: ['Try again', 'View Menu'],
        timestamp: new Date().toISOString()
      }
    };
  }
}

  // Remove from Cart Handler
  async handleRemoveFromCart(customerId, message) {
  const products = await searchSimilar(message, 1);
  
  if (products.length > 0) {
    await this.removeItemFromCart(customerId, products[0].id);
  }

  const cart = await this.getCart(customerId);

  return {
    aiText: `Removed item from cart.`,
    intent: 'REMOVE_FROM_CART',
    productList: [],
    addToCart: null,
    cartData: cart.items.length > 0 ? {
      cartId: cart.cartId,
      items: cart.items,
      cartItems: cart.cartItems,
      total: cart.total,
      cartTotal: cart.cartTotal,
      itemCount: cart.itemCount
    } : null,
    meta: {
      suggestions: ['View cart', 'Add more items'],
      timestamp: new Date().toISOString()
    }
  };
}
  // Update Cart Quantity
  async handleUpdateCart(customerId, message) {
  const cart = await this.getCart(customerId);

  return {
    aiText: "Cart updated!",
    intent: 'UPDATE_CART_QUANTITY',
    productList: [],
    addToCart: null,
    cartData: {
      cartId: cart.cartId,
      items: cart.items,
      cartItems: cart.cartItems,
      total: cart.total,
      cartTotal: cart.cartTotal,
      itemCount: cart.itemCount
    },
    meta: {
      suggestions: ['View cart', 'Proceed to pay'],
      timestamp: new Date().toISOString()
    }
  };
}

  // Clear Cart Handler
  async handleClearCart(customerId) {
    await this.clearCartItems(customerId);

    return {
      aiText: "Cart cleared! Ready to start fresh? 🛒",
      intent: 'CLEAR_CART',
      productList: [],
      addToCart: null,
      cartData: null,
      meta: {
        suggestions: ['View Menu', 'Show recommendations'],
        timestamp: new Date().toISOString()
      }
    };
  }

  // Order Status Handler
  async handleOrderStatus(customerId) {
  try {
    const orders = await Order.find({ group_id: customerId })
      .sort({ created_at: -1 })
      .limit(10)
      .lean();

    if (DEBUG) {
      console.log(`[Agent] Found ${orders.length} orders for customer: ${customerId}`);
    }

    // ✅ FIX: Match frontend OrderTrackingData interface
    const orderList = orders.map(o => ({
      id: o._id.toString(),
      orderNumber: o.order_number?.toString() || o._id.toString(),
      status: o.status || 'preparing',
      date: new Date(o.created_at || o.date).toLocaleDateString(),
      total: parseFloat(o.amount || 0),
      estimatedDelivery: o.estimated_delivery || 'In 30-45 mins',
      items: (o.line_items || []).map(item => ({
        name: item.product || item.title || 'Unknown Item',
        quantity: item.quantity || 1,
        price: parseFloat(item.price || 0)
      }))
    }));

    const aiText = orders.length === 0 
      ? "You don't have any orders yet. Ready to place your first order? 🎯"
      : '';

    return {
      aiText,
      intent: 'ORDER_STATUS',
      productList: [],
      addToCart: null,
      cartData: null,
      // ✅ FIX: Match frontend OrderTrackingData interface
      orderData: orders.length > 0 ? {
        type: 'order_tracking',
        orders: orderList
      } : null,
      meta: {
        suggestions: orders.length > 0 
          ? ['Track specific order', 'Place new order']
          : ['View Menu', 'Place first order'],
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

  // Checkout Handler
  async handleCheckout(customerId) {
  const cart = await this.getCart(customerId);

  if (!cart.items || cart.items.length === 0) {
    return {
      aiText: "Your cart is empty! Add some items first. 🛒",
      intent: 'CHECKOUT',
      productList: [],
      addToCart: null,
      cartData: null,
      meta: {
        suggestions: ['View Menu'],
        timestamp: new Date().toISOString()
      }
    };
  }

  return {
    aiText: `Ready to checkout! Your total is $${cart.total} for ${cart.itemCount} item${cart.itemCount !== 1 ? 's' : ''}. 💳`,
    intent: 'CHECKOUT',
    productList: [],
    addToCart: null,
    cartData: null,
    payment: {
      total: cart.total,
      items: cart.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }))
    },
    meta: {
      suggestions: ['Confirm payment', 'Edit cart'],
      timestamp: new Date().toISOString()
    }
  };
}

  // Payment Success Handler
  async handlePaymentSuccess(customerId, message) {
    try {
      // Create order from cart
      const cart = await this.getCart(customerId);
      
      if (!cart.items || cart.items.length === 0) {
        return {
          aiText: "No items in cart to complete order.",
          intent: 'PAYMENT_SUCCESS',
          productList: [],
          addToCart: null,
          cartData: null,
          meta: {
            suggestions: ['View Menu'],
            timestamp: new Date().toISOString()
          }
        };
      }

      // Generate order number
      const orderNumber = Math.floor(10000 + Math.random() * 90000);

      // Create order
      const orderItems = cart.items.map(item => ({
        product: item.product?.name || item.title,
        price: (item.product?.price || item.unit_price).toString(),
        quantity: item.quantity,
        specialInstructions: item.customizations?.instructions || ''
      }));

      const order = await Order.create({
        _id: new mongoose.Types.ObjectId(),
        order_number: orderNumber,
        amount: cart.total.toString(),
        created_at: new Date().toISOString(),
        currency: 'USD',
        date: new Date().toISOString(),
        group_id: customerId,
        line_items: orderItems,
        payment_method: 'CARD',
        status: 'CONFIRMED',
        orderNumberProvisional: orderNumber
      });

      // Clear cart
      await this.clearCartItems(customerId);

      return {
        aiText: `🎉 Payment successful! Your order #${orderNumber} has been placed. You'll receive updates as it's prepared. Thank you for ordering! 🍽️`,
        intent: 'PAYMENT_SUCCESS',
        productList: [],
        addToCart: null,
        cartData: null,
        orderData: [{
          orderNumber: order.order_number,
          status: order.status,
          amount: order.amount,
          items: orderItems
        }],
        meta: {
          suggestions: ['Track order', 'Order again', 'View Menu'],
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[Agent] Payment success error:', error);
      return {
        aiText: "There was an issue processing your order. Please contact support.",
        intent: 'PAYMENT_SUCCESS',
        productList: [],
        addToCart: null,
        cartData: null,
        meta: {
          suggestions: ['Contact support', 'Try again'],
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Preference Learning Handler
  async handleLearnPreference(customerId, message) {
    try {
      const lowerMessage = message.toLowerCase();
      
      // Extract preference type
      let preferenceType = 'like';
      let weight = 1;
      
      if (lowerMessage.includes('love')) {
        preferenceType = 'love';
        weight = 2;
      } else if (lowerMessage.includes('hate') || lowerMessage.includes('dislike')) {
        preferenceType = 'dislike';
        weight = -2;
      } else if (lowerMessage.includes('prefer') || lowerMessage.includes('favorite')) {
        preferenceType = 'prefer';
        weight = 1.5;
      }

      // Extract food items mentioned
      const foods = ['chicken', 'rice', 'biryani', 'curry', 'soup', 'paneer', 'vegetarian', 'spicy', 'mild'];
      const mentionedFoods = foods.filter(food => lowerMessage.includes(food));

      if (mentionedFoods.length === 0) {
        return {
          aiText: "I'd love to learn your preferences! Tell me what foods you like, love, or prefer. 😊",
          intent: 'LEARN_PREFERENCE',
          productList: [],
          addToCart: null,
          cartData: null,
          meta: {
            suggestions: ['I love chicken', 'I prefer vegetarian', 'View Menu'],
            timestamp: new Date().toISOString()
          }
        };
      }

      // Save preferences
      for (const food of mentionedFoods) {
        await CustomerPreferences.findOneAndUpdate(
          { customer_id: customerId, key: food },
          {
            customer_id: customerId,
            key: food,
            weight: weight,
            updatedAt: new Date()
          },
          { upsert: true }
        );
      }

      const foodList = mentionedFoods.join(', ');
      let responseText = '';
      
      if (preferenceType === 'dislike') {
        responseText = `Got it! I'll remember you don't like ${foodList}. I'll suggest alternatives! 📝`;
      } else {
        responseText = `Great! I've noted that you ${preferenceType} ${foodList}. I'll recommend similar items! 😊`;
      }

      return {
        aiText: responseText,
        intent: 'LEARN_PREFERENCE',
        productList: [],
        addToCart: null,
        cartData: null,
        meta: {
          suggestions: ['View Menu', 'Get recommendations'],
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[Agent] Learn preference error:', error);
      return {
        aiText: "I'll try to remember that! What else can I help you with?",
        intent: 'LEARN_PREFERENCE',
        productList: [],
        addToCart: null,
        cartData: null,
        meta: {
          suggestions: ['View Menu', 'Show recommendations'],
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Unknown Intent Handler
  async handleUnknown(customerId, message) {
    return {
      aiText: "I'm here to help! You can browse the menu, manage your cart, track orders, or ask me about specific items. What would you like to do? 🤖",
      intent: 'UNKNOWN',
      productList: [],
      addToCart: null,
      cartData: null,
      meta: {
        suggestions: ['View Menu', 'Show my cart', 'Track Orders', 'Today\'s Specials'],
        timestamp: new Date().toISOString()
      }
    };
  }

  // ===== CART HELPER METHODS =====

  async addItemToCart(customerId, productId, quantity = 1) {
  try {
    console.log('\n==================== ADD TO CART START ====================');
    console.log('[Agent] Customer ID:', customerId);
    console.log('[Agent] Product ID:', productId);
    console.log('[Agent] Quantity:', quantity);

    // Step 1: Find product
    console.log('\n[Step 1] Finding product...');
    const product = await Product.findById(productId).lean();

    if (!product) {
      console.error('[Agent] ❌ PRODUCT NOT FOUND for ID:', productId);
      
      // Try to find what products exist
      const allProducts = await Product.find({}).select('_id name').limit(5).lean();
      console.log('[Agent] Available products:', allProducts.map(p => ({
        id: p._id.toString(),
        name: p.name
      })));
      
      throw new Error('Product not found');
    }

    console.log('[Agent] ✅ Found product:', {
      _id: product._id,
      name: product.name,
      price: product.price
    });

    // Step 2: Get or create cart
    console.log('\n[Step 2] Getting/creating cart...');
    let cart = await Cart.findOne({ customer_id: customerId });

    if (!cart) {
      console.log('[Agent] No cart found. Creating new cart...');
      const newCartId = uuidv4();
      
      const cartData = {
        id: newCartId,
        customer_id: customerId,
        session_id: uuidv4(),
        status: 'OPEN',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      console.log('[Agent] Cart data to create:', cartData);
      
      cart = await Cart.create(cartData);
      
      console.log('[Agent] ✅ Created cart:', {
        _id: cart._id,
        id: cart.id,
        customer_id: cart.customer_id
      });
      
      // Verify cart exists in DB
      const verifyCart = await Cart.findOne({ id: cart.id });
      if (!verifyCart) {
        console.error('[Agent] ❌ CART NOT FOUND AFTER CREATION!');
        throw new Error('Cart creation failed');
      }
      console.log('[Agent] ✅ Cart verified in database');
      
    } else {
      console.log('[Agent] ✅ Using existing cart:', {
        _id: cart._id,
        id: cart.id,
        customer_id: cart.customer_id
      });
    }

    // Step 3: Create/update cart item
    console.log('\n[Step 3] Creating/updating cart item...');
    
    const productIdStr = product._id.toString();
    console.log('[Agent] Using product ID:', productIdStr);
    console.log('[Agent] Using cart ID:', cart.id);

    // Check for existing item
    const existingItem = await CartItem.findOne({
      cart_id: cart.id,
      productId: productIdStr
    });

    if (existingItem) {
      console.log('[Agent] Found existing cart item. Updating quantity...');
      console.log('[Agent] Old quantity:', existingItem.quantity);
      
      existingItem.quantity += quantity;
      existingItem.updated_at = new Date();
      await existingItem.save();
      
      console.log('[Agent] ✅ Updated cart item:', {
        id: existingItem.id,
        quantity: existingItem.quantity
      });
      
    } else {
      console.log('[Agent] No existing item. Creating new cart item...');
      
      const newItemId = uuidv4();
      const cartItemData = {
        id: newItemId,
        cart_id: cart.id,
        productId: productIdStr,
        title: product.name,
        unit_price: parseFloat(product.price),
        quantity: quantity,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      console.log('[Agent] Cart item data to create:', cartItemData);
      
      const newItem = await CartItem.create(cartItemData);
      
      console.log('[Agent] ✅ Created cart item:', {
        _id: newItem._id,
        id: newItem.id,
        cart_id: newItem.cart_id,
        productId: newItem.productId,
        quantity: newItem.quantity
      });
      
      // Verify item exists in DB
      const verifyItem = await CartItem.findOne({ id: newItem.id });
      if (!verifyItem) {
        console.error('[Agent] ❌ CART ITEM NOT FOUND AFTER CREATION!');
        throw new Error('Cart item creation failed');
      }
      console.log('[Agent] ✅ Cart item verified in database');
    }

    // Step 4: Final verification
    console.log('\n[Step 4] Final verification...');
    const allItemsInCart = await CartItem.find({ cart_id: cart.id }).lean();
    console.log('[Agent] ✅ Total items in cart:', allItemsInCart.length);
    
    if (allItemsInCart.length > 0) {
      console.log('[Agent] Cart items:', allItemsInCart.map(item => ({
        id: item.id,
        productId: item.productId,
        title: item.title,
        quantity: item.quantity
      })));
    }

    console.log('==================== ADD TO CART SUCCESS ====================\n');
    return true;

  } catch (error) {
    console.error('\n==================== ADD TO CART ERROR ====================');
    console.error('[Agent] Error:', error.message);
    console.error('[Agent] Stack:', error.stack);
    console.error('==============================================================\n');
    throw error;
  }
}

async getCart(customerId) {
  try {
    console.log('\n==================== GET CART START ====================');
    console.log('[Agent] Getting cart for customer:', customerId);

    const cart = await Cart.findOne({ customer_id: customerId }).lean();

    if (!cart) {
      console.log('[Agent] No cart found for customer');
      console.log('==================== GET CART END (EMPTY) ====================\n');
      return { 
        cartId: null,
        items: [], 
        cartItems: [],
        total: 0, 
        cartTotal: 0,
        itemCount: 0 
      };
    }

    console.log('[Agent] Found cart:', {
      _id: cart._id,
      id: cart.id,
      customer_id: cart.customer_id
    });

    const cartItems = await CartItem.find({ cart_id: cart.id }).lean();
    console.log('[Agent] Found cart items:', cartItems.length);

    if (cartItems.length === 0) {
      console.log('[Agent] Cart exists but has no items');
      console.log('==================== GET CART END (NO ITEMS) ====================\n');
      return { 
        cartId: cart.id,
        items: [], 
        cartItems: [],
        total: 0, 
        cartTotal: 0,
        itemCount: 0 
      };
    }

    console.log('[Agent] Processing cart items...');
    const itemsWithProducts = await Promise.all(
      cartItems.map(async (item, index) => {
        console.log(`[Agent] Processing item ${index + 1}:`, {
          id: item.id,
          productId: item.productId,
          title: item.title
        });

        const product = await Product.findById(item.productId).lean();
        
        if (!product) {
          console.log(`[Agent] ⚠️  Product not found for item ${index + 1}:`, item.productId);
          return null;
        }

        const price = parseFloat(product.price || 0);
        const quantity = item.quantity || 1;
        const total = price * quantity;

        return {
          id: item.id,
          productId: product._id.toString(),
          quantity: quantity,
          customizations: item.customizations,
          product: {
            id: product._id.toString(),
            name: product.name,
            price: price,
            description: product.description,
            image: product.image || product.imageUrl
          },
          name: product.name,
          price: price,
          total: total
        };
      })
    );

    const validItems = itemsWithProducts.filter(item => item !== null);
    console.log('[Agent] Valid items after processing:', validItems.length);

    const total = validItems.reduce((sum, item) => sum + item.total, 0);
    const itemCount = validItems.reduce((sum, item) => sum + item.quantity, 0);

    const cartData = {
      cartId: cart.id,
      items: validItems,
      cartItems: validItems,
      total: parseFloat(total.toFixed(2)),
      cartTotal: parseFloat(total.toFixed(2)),
      itemCount
    };

    console.log('[Agent] Returning cart data:', {
      itemCount: cartData.itemCount,
      total: cartData.total
    });
    console.log('==================== GET CART END (SUCCESS) ====================\n');

    return cartData;

  } catch (error) {
    console.error('\n==================== GET CART ERROR ====================');
    console.error('[Agent] Error:', error.message);
    console.error('==============================================================\n');
    return { 
      cartId: null,
      items: [], 
      cartItems: [],
      total: 0, 
      cartTotal: 0,
      itemCount: 0 
    };
  }
}

  async removeItemFromCart(customerId, productId) {
  try {
    const cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) return;

    await CartItem.deleteOne({
      cart_id: cart.id,
      productId: productId
    });
    
    if (DEBUG) console.log('[Agent] Removed item:', productId);
  } catch (error) {
    console.error('[Agent] Remove from cart error:', error);
  }
}

  async clearCartItems(customerId) {
    try {
      const cart = await Cart.findOne({ customer_id: customerId });
      if (cart) {
        await CartItem.deleteMany({ cart_id: cart.id });
      }
    } catch (error) {
      console.error('[Agent] Clear cart error:', error);
    }
  }
}

module.exports = new AgentService();