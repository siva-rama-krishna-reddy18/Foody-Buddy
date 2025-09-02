const { PrismaClient } = require('@prisma/client');
const { enhancedClassify } = require('./intentService');
const { PreferenceService, RecommendationService, CartService } = require('./enhancedChatbotSystem');
const { OrderService } = require('./orderService');
const { PaymentService } = require('./paymentService');
const { searchSimilar } = require('./vectorService');
const { getCatalog, normalizeDay } = require('./catalogService');

const prisma = new PrismaClient();

class EnhancedOrchestratorService {
  
  constructor() {
    this.preferenceService = new PreferenceService();
    this.recommendationService = new RecommendationService();
    this.cartService = new CartService();
    this.orderService = new OrderService();
    this.paymentService = new PaymentService();
  }
  
  async respondToMessage({ sessionId, customerId, content, context = {} }) {
    try {
      const classification = enhancedClassify(content);
      const { intent, entities } = classification;
      
      console.log(`[Enhanced Orchestrator] Intent: ${intent}`, entities);
      
      switch (intent) {
        case 'GREETING':
          return await this.handleGreeting(customerId);
          
        case 'ORDER_STATUS':
          return await this.handleOrderStatus(customerId, entities);
          
        case 'RECOMMENDATION':
          return await this.handleRecommendation(customerId, entities, context);
          
        case 'PREFERENCE_UPDATE':
          return await this.handlePreferenceUpdate(customerId, entities);
          
        case 'CART_MANAGEMENT':
          return await this.handleCartManagement(sessionId, entities, content);
          
        case 'PAYMENT':
          return await this.handlePayment(sessionId, customerId, entities);
          
        case 'SEARCH':
        case 'ADD_TO_CART':
          return await this.handleProductSearch(sessionId, customerId, content, intent);
          
        case 'CHECKOUT':
          return await this.handleCheckout(sessionId, customerId);
          
        default:
          return await this.handleGeneral(sessionId, customerId, content);
      }
    } catch (error) {
      console.error('Enhanced orchestrator error:', error);
      return {
        aiText: "I apologize, but I'm having trouble processing your request. Please try again or contact support if the issue persists.",
        productList: [],
        intent: 'ERROR'
      };
    }
  }
  
  async handleGreeting(customerId) {
    try {
      // Get user preferences to personalize greeting
      const preferences = await this.preferenceService.getCustomerPreferences(customerId);
      const orderHistory = await this.preferenceService.analyzeOrderHistory(customerId);
      
      let greeting = "Welcome to FoodyBuddy! ";
      
      if (orderHistory.favoriteItems.length > 0) {
        const topItem = orderHistory.favoriteItems[0];
        greeting += `I see you love ${topItem.name}! Would you like to order that again, or try something new?`;
      } else {
        greeting += "What delicious food can I help you discover today?";
      }
      
      // Get quick recommendations
      const recommendations = await this.recommendationService.getPersonalizedRecommendations(customerId);
      
      return {
        aiText: greeting,
        productList: recommendations.slice(0, 3).map(item => ({
          id: item.id,
          title: item.name,
          price: item.price,
          category: item.category,
          reason: item.reason
        })),
        intent: 'GREETING',
        suggestions: ['Show me recommendations', 'View menu', 'Check my cart']
      };
    } catch (error) {
      return {
        aiText: "Welcome to FoodyBuddy! What can I help you order today?",
        productList: [],
        intent: 'GREETING'
      };
    }
  }
  
  async handleOrderStatus(customerId, entities) {
    try {
      if (entities.orderId) {
        // Specific order status
        const orderStatus = await this.orderService.getOrderStatus(entities.orderId, customerId);
        
        if (!orderStatus) {
          return {
            aiText: `I couldn't find an order with ID ${entities.orderId}. Please check the order ID and try again.`,
            productList: [],
            intent: 'ORDER_STATUS'
          };
        }
        
        const statusMessage = this.formatOrderStatus(orderStatus);
        return {
          aiText: statusMessage,
          orderDetails: orderStatus,
          intent: 'ORDER_STATUS'
        };
      } else {
        // Recent orders
        const recentOrders = await this.orderService.getCustomerOrders(customerId, 5);
        
        if (recentOrders.length === 0) {
          return {
            aiText: "You don't have any recent orders. Would you like to place a new order?",
            productList: [],
            intent: 'ORDER_STATUS',
            suggestions: ['Show me recommendations', 'View menu']
          };
        }
        
        const ordersText = recentOrders.map((order, i) => 
          `${i + 1}. Order #${order.id} - ${order.status} - ${order.totalAmount}`
        ).join('\n');
        
        return {
          aiText: `Here are your recent orders:\n\n${ordersText}\n\nWould you like details on any specific order?`,
          orders: recentOrders,
          intent: 'ORDER_STATUS'
        };
      }
    } catch (error) {
      console.error('Order status error:', error);
      return {
        aiText: "I'm having trouble retrieving your order information. Please try again later.",
        productList: [],
        intent: 'ORDER_STATUS'
      };
    }
  }
  
  async handleRecommendation(customerId, entities, context) {
    try {
      const recommendations = await this.recommendationService.getPersonalizedRecommendations(
        customerId, 
        { ...context, preferences: entities.preferences }
      );
      
      if (recommendations.length === 0) {
        return {
          aiText: "I'm having trouble finding recommendations right now. Let me show you our popular items instead!",
          productList: await this.getPopularItems(),
          intent: 'RECOMMENDATION'
        };
      }
      
      const reasonsText = recommendations.map((item, i) => 
        `${i + 1}. ${item.name} - ${item.price} (${item.reason})`
      ).join('\n');
      
      return {
        aiText: `Here are my personalized recommendations for you:\n\n${reasonsText}\n\nWould you like to add any of these to your cart?`,
        productList: recommendations.map(item => ({
          id: item.id,
          title: item.name,
          price: item.price,
          category: item.category,
          reason: item.reason,
          confidence: item.confidence
        })),
        intent: 'RECOMMENDATION'
      };
    } catch (error) {
      console.error('Recommendation error:', error);
      return {
        aiText: "Let me show you some popular items that others have enjoyed!",
        productList: await this.getPopularItems(),
        intent: 'RECOMMENDATION'
      };
    }
  }
  
  async handlePreferenceUpdate(customerId, entities) {
    try {
      await this.preferenceService.updateCustomerPreferences(customerId, entities);
      
      let responseText = "Thanks for letting me know your preferences! ";
      
      if (entities.liked && entities.liked.length > 0) {
        responseText += `I've noted that you like: ${entities.liked.join(', ')}. `;
      }
      
      if (entities.disliked && entities.disliked.length > 0) {
        responseText += `I'll remember to avoid: ${entities.disliked.join(', ')}. `;
      }
      
      responseText += "This helps me give you better recommendations!";
      
      return {
        aiText: responseText,
        productList: [],
        intent: 'PREFERENCE_UPDATE',
        suggestions: ['Show me recommendations', 'View menu']
      };
    } catch (error) {
      return {
        aiText: "I've noted your preferences and will use them to improve your recommendations!",
        productList: [],
        intent: 'PREFERENCE_UPDATE'
      };
    }
  }
  
  async handleCartManagement(sessionId, entities, content) {
    try {
      const action = entities.action || 'view';
      
      switch (action) {
        case 'view':
          const cart = await this.cartService.getCart(sessionId);
          return this.formatCartResponse(cart);
          
        case 'add':
          // Extract product from content
          const productToAdd = await this.extractProductFromText(content);
          if (productToAdd) {
            const updatedCart = await this.cartService.addToCart(
              sessionId, 
              productToAdd.id, 
              productToAdd.quantity || 1
            );
            return {
              aiText: `Added ${productToAdd.name} to your cart! Your cart now has ${updatedCart.itemCount} items totaling ${updatedCart.total.toFixed(2)}.`,
              cart: updatedCart,
              intent: 'CART_MANAGEMENT'
            };
          }
          break;
          
        case 'remove':
          // Handle remove logic
          return await this.handleCartRemove(sessionId, content);
          
        default:
          const currentCart = await this.cartService.getCart(sessionId);
          return this.formatCartResponse(currentCart);
      }
    } catch (error) {
      console.error('Cart management error:', error);
      return {
        aiText: "I'm having trouble with your cart. Please try again.",
        productList: [],
        intent: 'CART_MANAGEMENT'
      };
    }
  }
  
  async handlePayment(sessionId, customerId, entities) {
    try {
      const cart = await this.cartService.getCart(sessionId);
      
      if (!cart || cart.items.length === 0) {
        return {
          aiText: "Your cart is empty. Please add some items before proceeding to payment.",
          productList: [],
          intent: 'PAYMENT'
        };
      }
      
      // Generate payment options
      const paymentOptions = [
        { method: 'card', name: 'Credit/Debit Card', icon: '💳' },
        { method: 'paypal', name: 'PayPal', icon: '🟦' },
        { method: 'razorpay', name: 'UPI/Razorpay', icon: '💰' }
      ];
      
      return {
        aiText: `Your cart total is ${cart.total.toFixed(2)}. How would you like to pay?`,
        cart: cart,
        paymentOptions: paymentOptions,
        intent: 'PAYMENT',
        requiresAction: true,
        actionType: 'payment_method_selection'
      };
    } catch (error) {
      console.error('Payment handling error:', error);
      return {
        aiText: "I'm having trouble processing payment. Please try again.",
        productList: [],
        intent: 'PAYMENT'
      };
    }
  }
  
  formatOrderStatus(orderStatus) {
    const status = orderStatus.status;
    const statusMessages = {
      'pending': 'Your order is being prepared',
      'confirmed': 'Your order has been confirmed and is being prepared',
      'preparing': 'Your order is currently being prepared',
      'ready': 'Your order is ready for pickup/delivery',
      'out_for_delivery': 'Your order is out for delivery',
      'delivered': 'Your order has been delivered',
      'cancelled': 'Your order has been cancelled'
    };
    
    let message = `Order #${orderStatus.id}: ${statusMessages[status] || status}\n`;
    message += `Total: ${orderStatus.totalAmount}\n`;
    
    if (orderStatus.estimatedDeliveryTime && status !== 'delivered') {
      const deliveryTime = new Date(orderStatus.estimatedDeliveryTime);
      message += `Estimated ${orderStatus.deliveryType}: ${deliveryTime.toLocaleTimeString()}`;
    }
    
    return message;
  }
  
  formatCartResponse(cart) {
    if (!cart || cart.items.length === 0) {
      return {
        aiText: "Your cart is empty. Would you like to see some recommendations?",
        productList: [],
        intent: 'CART_MANAGEMENT',
        suggestions: ['Show recommendations', 'View menu']
      };
    }
    
    const itemsText = cart.items.map((item, i) => 
      `${i + 1}. ${item.product.name} x ${item.quantity} - ${(item.product.price * item.quantity).toFixed(2)}`
    ).join('\n');
    
    return {
      aiText: `Your cart (${cart.itemCount} items):\n\n${itemsText}\n\nTotal: ${cart.total.toFixed(2)}\n\nReady to checkout?`,
      cart: cart,
      intent: 'CART_MANAGEMENT',
      suggestions: ['Checkout', 'Add more items', 'Clear cart']
    };
  }
  
  async getPopularItems() {
    try {
      const products = await prisma.product.findMany({
        where: { availability: true },
        take: 5,
        orderBy: { name: 'asc' }
      });
      
      return products.map(p => ({
        id: p.id,
        title: p.name,
        price: p.price,
        category: p.category
      }));
    } catch (error) {
      return [];
    }
  }
}

module.exports = { 
  OrderService, 
  PaymentService, 
  EnhancedOrchestratorService 
};