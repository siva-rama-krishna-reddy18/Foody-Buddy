// src/services/agentService.js
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();
const { classifyIntent } = require('./intentService');
const { searchSimilar } = require('./vectorService');
const { generateEmbedding } = require('./embeddingService');

const DEBUG = process.env.NODE_ENV === 'development';

class AgentService {
  constructor() {
    this.sessionMemory = new Map();
    if (DEBUG) console.log('[Agent] Enhanced AgentService initialized');
  }

  // Add respond() method to match your existing controller
  async respond({ sessionId, customerId, text }) {
    try {
      const result = await this.processMessage(customerId, sessionId, text);
      
      // Convert to format your controller expects
      return {
        aiText: result.response,
        intent: result.intent,
        productList: result.products || [],
        addToCart: await this.getCartData(customerId), // Include current cart state
        meta: {
          suggestions: result.suggestions || [],
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[Agent] Respond method error:', error);
      return {
        aiText: "Sorry, I'm having technical difficulties. Please try again.",
        intent: 'ERROR',
        productList: [],
        addToCart: null,
        meta: { error: error.message }
      };
    }
  }

  // Helper method to get current cart data from database
  async getCartData(customerId) {
    try {
      // First, find a cart for this customer using correct field name
      let cart = await prisma.carts.findFirst({
        where: { customer_id: customerId }  // Use customer_id, not customerId
      });

      if (!cart) {
        // No cart exists, so no items
        return null;
      }

      // Now get cart items using the cart_id
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

  async processMessage(customerId, sessionId, message) {
    try {
      if (DEBUG) console.log(`[Agent] Processing: "${message}" for customer: ${customerId}`);

      // Log interaction (with proper error handling)
      await this.logInteraction(customerId, sessionId, message);

      // Classify intent
      const intent = await classifyIntent(message);
      if (DEBUG) console.log(`[Agent] Intent: ${intent}`);

      let response;
      let products = [];
      let suggestions = [];

      // Handle different intents
      switch (intent) {
        case 'GREETING':
          response = await this.handleGreeting(customerId);
          break;

        case 'ORDER_STATUS':
          response = await this.handleOrderStatus(customerId);
          suggestions = ['Show recommendations', 'View menu'];
          break;

        case 'RECOMMEND':
          ({ response, products } = await this.handleRecommendations(customerId));
          break;

        case 'SEARCH':
          ({ response, products } = await this.handleSearch(message));
          break;

        case 'ADD_TO_CART':
          response = await this.handleAddToCart(customerId, sessionId, message);
          break;

        case 'VIEW_CART':
          response = await this.handleViewCart(customerId);
          break;

        case 'LEARN_PREFERENCE':
          response = await this.handlePreferenceLearning(customerId, message);
          break;

        default:
          response = "I'm here to help you with orders, recommendations, and questions about our food. What would you like to know?";
      }

      // Log the response
      await this.logInteraction(customerId, sessionId, message, intent, null, response, products);

      return {
        intent,
        response,
        products,
        suggestions
      };

    } catch (error) {
      console.error('[Agent] Error:', error);
      return {
        intent: 'ERROR',
        response: "I'm having some technical difficulties. Please try again in a moment.",
        products: [],
        suggestions: []
      };
    }
  }

  async handleGreeting(customerId) {
    try {
      // Get customer info - check both possible field names
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
        // Get recent orders - try different field combinations
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

          return `Welcome back, ${customer.name || 'valued customer'}! I see you've ordered from us before.\n\nYour recent orders:\n- ${orderSummary}\n\nWhat can I help you with today?`;
        }
      }

      return "Welcome to FoodyBuddy! I'm your AI assistant here to help you order delicious food. What can I help you with today?";
    } catch (error) {
      console.error('[Agent] Greeting error:', error);
      return "Welcome to FoodyBuddy! What can I help you order today?";
    }
  }

  async handleOrderStatus(customerId) {
    try {
      let orders = [];
      
      try {
        orders = await prisma.order.findMany({
          where: { customer_id: customerId },
          orderBy: { created_at: 'desc' },
          take: 5,
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
        } catch (fallbackError) {
          if (DEBUG) console.log('[Agent] Order status lookup failed:', fallbackError.message);
        }
      }

      if (orders.length === 0) {
        return "You don't have any recent orders. Would you like to place a new order? I can show you our popular items or help you search for something specific!";
      }

      const orderList = orders.map(order => {
        let items = '';
        let status = '';
        let total = '';
        let date = '';
        
        if (order.order_items) {
          items = order.order_items.slice(0, 2).map(item => item.product?.name || 'Item').join(', ');
          status = order.status || 'Completed';
          total = order.total_amount || '0';
          date = new Date(order.created_at).toLocaleDateString();
        } else if (order.orderLineItems) {
          items = order.orderLineItems.slice(0, 2).map(item => item.productName).join(', ');
          status = order.status || 'Completed';
          total = order.total || '0';
          date = new Date(order.createdAt).toLocaleDateString();
        }

        return `${items} - ${status} (${date}) - $${total}`;
      }).join('\n');

      return `Here are your recent orders:\n\n${orderList}\n\nWould you like to reorder any of these items or place a new order?`;
    } catch (error) {
      console.error('[Agent] Order status error:', error);
      return "I'm having trouble accessing your order history right now. Would you like to place a new order instead?";
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
        const response = `I found these items for "${message}":\n\n` + 
          products.map(item => `• ${item.name} - $${item.price}${item.description ? '\n  ' + item.description : ''}`).join('\n');
        
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

  // In your agentService.js, find the searchProducts method and update it:
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
          where: { customer_id: customerId }  // Use customer_id, not customerId
        });

        if (!cart) {
          // Create a new cart for the customer
          cart = await prisma.carts.create({
            data: {
              id: uuidv4(), // Add required id field
              customer_id: customerId,  // Use customer_id, not customerId
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
          
          return `I've increased the quantity of "${product.name}" in your cart! You now have ${updatedItem.quantity} items. ($${totalPrice}) Use "show my cart" to view all items.`;
        } else {
          // Add new item to cart
          const cartItem = await prisma.cartItem.create({
            data: {
              id: uuidv4(), // Add required id field
              cart_id: cart.id,
              productId: product.id,
              title: product.name,
              unit_price: parseFloat(product.price),
              quantity: 1,
              created_at: new Date(),
              updated_at: new Date()
            }
          });

          return `I've added "${product.name}" to your cart! ($${product.price}) Use "show my cart" to view all items.`;
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
          return `I've increased the quantity of "${product.name}" in your cart! You now have ${quantity} items. ($${(parseFloat(product.price) * quantity).toFixed(2)}) (Note: Using temporary cart)`;
        } else {
          sessionData.cart.push({
            productId: product.id,
            name: product.name,
            price: parseFloat(product.price),
            quantity: 1,
            addedAt: new Date()
          });
          return `I've added "${product.name}" to your cart! ($${product.price}) (Note: Using temporary cart)`;
        }
      }

    } catch (error) {
      console.error('Add to cart error:', error);
      return "I'm having trouble with the cart system right now. Please try again or let me know if you'd like to place an order directly.";
    }
  }

  async handleViewCart(customerId) {
    try {
      // Find the cart for this customer
      const cart = await prisma.carts.findFirst({
        where: { customer_id: customerId }  // Use customer_id, not customerId
      });

      if (!cart) {
        return "Your cart is empty. Would you like to see our menu or get some recommendations? I can help you find something delicious!";
      }

      // Get cart items using cart_id
      const cartItems = await prisma.cartItem.findMany({
        where: { cart_id: cart.id },
        include: { products: true }
      });

      if (cartItems.length === 0) {
        return "Your cart is empty. Would you like to see our menu or get some recommendations? I can help you find something delicious!";
      }

      const total = cartItems.reduce((sum, item) => {
        return sum + (parseFloat(item.unit_price || 0) * item.quantity);
      }, 0);

      const itemList = cartItems.map(item => 
        `• ${item.title} x${item.quantity} - $${(parseFloat(item.unit_price || 0) * item.quantity).toFixed(2)}`
      ).join('\n');

      return `Your Cart:\n\n${itemList}\n\nTotal: $${total.toFixed(2)}\n\nReady to place your order? Just let me know and I'll help you checkout!`;

    } catch (error) {
      console.error('View cart error:', error);
      
      // Fallback to session memory
      if (this.sessionMemory.has(customerId)) {
        const sessionData = this.sessionMemory.get(customerId);
        const cartItems = sessionData.cart || [];

        if (cartItems.length > 0) {
          const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const itemList = cartItems.map(item => 
            `• ${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`
          ).join('\n');

          return `Your Cart (Temporary):\n\n${itemList}\n\nTotal: $${total.toFixed(2)}\n\nNote: Consider setting up cart database table for persistent storage.`;
        }
      }

      return "Your cart is empty. Would you like to see our menu?";
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
      // You can implement actual logging to database here if needed
    } catch (error) {
      if (DEBUG) console.log(`[Agent] Logging skipped:`, error.message);
    }
  }
}

// Export as direct class, not in object
module.exports = AgentService;