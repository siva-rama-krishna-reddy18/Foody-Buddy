// src/services/orderService.js
// Complete enhanced order service that works with your existing database structure

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEBUG = process.env.DEBUG_ORCHESTRATOR === 'true';

class OrderService {
  
  /**
   * Get order status by order number and customer ID
   */
  async getOrderStatus(orderNumber, customerId) {
    try {
      const order = await prisma.order.findFirst({
        where: {
          orderNumber: orderNumber,
          customerId: customerId
        },
        include: {
          orderLineItems: true,
          statusHistory: {
            orderBy: { timestamp: 'desc' }
          }
        }
      });
      
      if (!order) {
        return null;
      }
      
      return {
        orderNumber: order.orderNumber,
        status: order.status,
        amount: order.amount,
        paymentMethod: order.paymentMethod,
        paymentStatus: this.getPaymentStatus(order),
        createdAt: order.createdAt,
        items: order.orderLineItems,
        statusHistory: order.statusHistory,
        estimatedDelivery: this.calculateEstimatedDelivery(order)
      };
    } catch (error) {
      console.error('Error fetching order status:', error);
      return null;
    }
  }
  
  /**
   * Get customer orders with pagination
   */
  async getCustomerOrders(customerId, limit = 10, offset = 0) {
    try {
      const orders = await prisma.order.findMany({
        where: { customerId },
        include: {
          orderLineItems: {
            take: 3 // Limit items per order for performance
          },
          statusHistory: {
            orderBy: { timestamp: 'desc' },
            take: 1 // Only latest status
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });
      
      return orders.map(order => ({
        orderNumber: order.orderNumber,
        status: order.status,
        amount: order.amount,
        createdAt: order.createdAt,
        itemCount: order.orderLineItems.length,
        items: order.orderLineItems,
        latestStatusUpdate: order.statusHistory[0]
      }));
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      return [];
    }
  }
  
  /**
   * Update order status and create history entry
   */
  async updateOrderStatus(orderNumber, newStatus, notes = '') {
    try {
      // Update order status
      const order = await prisma.order.update({
        where: { orderNumber },
        data: { 
          status: newStatus,
          updatedAt: new Date()
        }
      });
      
      // Create status history entry
      await prisma.orderStatusHistory.create({
        data: {
          orderNumber,
          status: newStatus,
          notes,
          timestamp: new Date()
        }
      });
      
      if (DEBUG) {
        console.log(`[OrderService] Updated order ${orderNumber} to ${newStatus}`);
      }
      
      return order;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }
  
  /**
   * Create order from shopping cart
   */
  async createOrderFromCart(sessionId, customerId, orderDetails = {}) {
    try {
      // Get cart items
      const cartItems = await prisma.cartItem.findMany({
        where: { sessionId }
      });
      
      if (cartItems.length === 0) {
        throw new Error('Cart is empty');
      }
      
      // Get product details for pricing
      const productIds = cartItems.map(item => item.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } }
      });
      
      const productMap = products.reduce((map, product) => {
        map[product.id] = product;
        return map;
      }, {});
      
      // Calculate totals
      const subtotal = cartItems.reduce((sum, item) => {
        const product = productMap[item.productId];
        return sum + (parseFloat(product?.price || 0) * item.quantity);
      }, 0);
      
      const tax = subtotal * 0.08; // 8% tax
      const total = subtotal + tax;
      
      // Create order using your existing structure
      const order = await prisma.order.create({
        data: {
          customerId: customerId,
          amount: total,
          status: 'pending',
          paymentMethod: orderDetails.paymentMethod || 'pending',
          currency: 'USD',
          createdAt: new Date(),
          groupId: orderDetails.groupId,
          orderLineItems: {
            create: cartItems.map(item => {
              const product = productMap[item.productId];
              return {
                productId: item.productId,
                productName: product?.name || 'Unknown Product',
                price: product?.price || 0,
                quantity: item.quantity,
                preference: JSON.stringify(item.customizations) || null
              };
            })
          }
        },
        include: {
          orderLineItems: true
        }
      });
      
      // Create initial status history
      await prisma.orderStatusHistory.create({
        data: {
          orderNumber: order.orderNumber,
          status: 'pending',
          notes: 'Order created from cart',
          timestamp: new Date()
        }
      });
      
      // Clear cart after successful order creation
      await prisma.cartItem.deleteMany({
        where: { sessionId }
      });
      
      // Clear cart record
      await prisma.shoppingCart.deleteMany({
        where: { sessionId }
      });
      
      if (DEBUG) {
        console.log(`[OrderService] Created order ${order.orderNumber} from cart`);
      }
      
      return order;
    } catch (error) {
      console.error('Error creating order from cart:', error);
      throw error;
    }
  }
  
  /**
   * Get order statistics for customer
   */
  async getCustomerOrderStats(customerId) {
    try {
      const stats = await prisma.order.aggregate({
        where: { customerId },
        _count: { orderNumber: true },
        _sum: { amount: true },
        _avg: { amount: true }
      });
      
      // Get favorite items
      const favoriteItems = await prisma.orderLineItem.groupBy({
        by: ['productName'],
        where: {
          order: { customerId }
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5
      });
      
      return {
        totalOrders: stats._count.orderNumber || 0,
        totalSpent: parseFloat(stats._sum.amount) || 0,
        averageOrderValue: parseFloat(stats._avg.amount) || 0,
        favoriteItems: favoriteItems.map(item => ({
          name: item.productName,
          totalQuantity: item._sum.quantity
        }))
      };
    } catch (error) {
      console.error('Error getting customer order stats:', error);
      return {
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        favoriteItems: []
      };
    }
  }
  
  /**
   * Search orders by various criteria
   */
  async searchOrders(filters = {}) {
    try {
      const whereClause = {};
      
      if (filters.customerId) {
        whereClause.customerId = filters.customerId;
      }
      
      if (filters.status) {
        whereClause.status = filters.status;
      }
      
      if (filters.dateFrom && filters.dateTo) {
        whereClause.createdAt = {
          gte: new Date(filters.dateFrom),
          lte: new Date(filters.dateTo)
        };
      }
      
      if (filters.minAmount || filters.maxAmount) {
        whereClause.amount = {};
        if (filters.minAmount) whereClause.amount.gte = parseFloat(filters.minAmount);
        if (filters.maxAmount) whereClause.amount.lte = parseFloat(filters.maxAmount);
      }
      
      const orders = await prisma.order.findMany({
        where: whereClause,
        include: {
          orderLineItems: true,
          customer: {
            select: { name: true, phone: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50
      });
      
      return orders;
    } catch (error) {
      console.error('Error searching orders:', error);
      return [];
    }
  }
  
  /**
   * Cancel order
   */
  async cancelOrder(orderNumber, customerId, reason = '') {
    try {
      const order = await prisma.order.findFirst({
        where: { orderNumber, customerId }
      });
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (['delivered', 'cancelled'].includes(order.status)) {
        throw new Error(`Cannot cancel order with status: ${order.status}`);
      }
      
      const updatedOrder = await this.updateOrderStatus(
        orderNumber, 
        'cancelled', 
        `Cancelled by customer. Reason: ${reason}`
      );
      
      return updatedOrder;
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }
  
  // Helper methods
  
  getPaymentStatus(order) {
    if (order.stripePaymentIntent) {
      return 'paid';
    }
    if (order.paymentMethod && order.paymentMethod !== 'pending') {
      return 'processing';
    }
    return 'pending';
  }
  
  calculateEstimatedDelivery(order) {
    if (order.status === 'delivered') {
      return null;
    }
    
    const now = new Date();
    const orderTime = new Date(order.createdAt);
    
    // Simple estimation: 45 minutes from order time
    const estimatedDelivery = new Date(orderTime.getTime() + (45 * 60 * 1000));
    
    // If estimated time has passed, add 30 minutes from now
    if (estimatedDelivery < now) {
      return new Date(now.getTime() + (30 * 60 * 1000));
    }
    
    return estimatedDelivery;
  }
  
  formatOrderForDisplay(order) {
    const statusMessages = {
      'pending': 'Order received and being processed',
      'confirmed': 'Order confirmed and being prepared',
      'preparing': 'Your order is being prepared',
      'ready': 'Order is ready for pickup/delivery',
      'out_for_delivery': 'Order is out for delivery',
      'delivered': 'Order has been delivered',
      'cancelled': 'Order was cancelled'
    };
    
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      statusMessage: statusMessages[order.status] || order.status,
      amount: order.amount,
      createdAt: order.createdAt,
      estimatedDelivery: this.calculateEstimatedDelivery(order),
      items: order.orderLineItems || [],
      itemCount: order.orderLineItems?.length || 0
    };
  }
}

// Export both class and individual functions for backward compatibility
const orderService = new OrderService();

module.exports = {
  OrderService,
  orderService,
  
  // Individual functions for backward compatibility
  getOrderStatus: (orderNumber, customerId) => 
    orderService.getOrderStatus(orderNumber, customerId),
    
  getCustomerOrders: (customerId, limit, offset) => 
    orderService.getCustomerOrders(customerId, limit, offset),
    
  updateOrderStatus: (orderNumber, status, notes) => 
    orderService.updateOrderStatus(orderNumber, status, notes),
    
  createOrderFromCart: (sessionId, customerId, orderDetails) => 
    orderService.createOrderFromCart(sessionId, customerId, orderDetails),
    
  getCustomerOrderStats: (customerId) => 
    orderService.getCustomerOrderStats(customerId),
    
  searchOrders: (filters) => 
    orderService.searchOrders(filters),
    
  cancelOrder: (orderNumber, customerId, reason) => 
    orderService.cancelOrder(orderNumber, customerId, reason)
};