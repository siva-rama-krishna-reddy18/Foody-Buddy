// src/services/orderService.js
const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Customer = require('../../models/Customer');
const Product = require('../../models/Product');

const DEBUG = process.env.DEBUG_ORCHESTRATOR === 'true';

class OrderService {
  
  /**
   * Get order status by order number and group_id (customer identifier)
   */
  async getOrderStatus(orderNumber, groupId) {
    try {
      const order = await Order.findOne({
        order_number: orderNumber,
        group_id: groupId
      }).lean();
      
      if (!order) {
        return null;
      }
      
      return {
        orderNumber: order.order_number,
        status: order.status,
        amount: order.amount,
        paymentMethod: order.payment_method,
        paymentStatus: this.getPaymentStatus(order),
        createdAt: order.created_at,
        items: order.line_items || [],
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
  async getCustomerOrders(groupId, limit = 10, offset = 0) {
    try {
      const orders = await Order.find({ group_id: groupId })
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(offset)
        .lean();
      
      return orders.map(order => ({
        orderNumber: order.order_number,
        status: order.status,
        amount: order.amount,
        createdAt: order.created_at,
        itemCount: order.line_items?.length || 0,
        items: order.line_items || []
      }));
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      return [];
    }
  }
  
  /**
   * Update order status
   */
  async updateOrderStatus(orderNumber, newStatus, notes = '') {
    try {
      const order = await Order.findOneAndUpdate(
        { order_number: orderNumber },
        { 
          status: newStatus,
          updated_at: new Date().toISOString()
        },
        { new: true }
      );
      
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
   * Create order from cart
   */
  async createOrderFromCart(groupId, cartItems, orderDetails = {}) {
    try {
      if (!cartItems || cartItems.length === 0) {
        throw new Error('Cart is empty');
      }
      
      // Calculate total
      const total = cartItems.reduce((sum, item) => {
        return sum + (parseFloat(item.price || 0) * (item.quantity || 1));
      }, 0);
      
      // Generate order number
      const orderNumber = Math.floor(100000 + Math.random() * 900000);
      
      // Create order
      const order = await Order.create({
        _id: new mongoose.Types.ObjectId(),
        order_number: orderNumber,
        group_id: groupId,
        amount: total.toString(),
        status: 'pending',
        payment_method: orderDetails.paymentMethod || '',
        currency: orderDetails.currency || 'usd',
        created_at: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        line_items: cartItems.map(item => ({
          product: item.productId || item.product,
          price: item.price?.toString() || '0',
          quantity: item.quantity || 1,
          specialInstructions: item.specialInstructions || ''
        })),
        stripe_payment_intent: orderDetails.stripePaymentIntent || ''
      });
      
      if (DEBUG) {
        console.log(`[OrderService] Created order ${order.order_number}`);
      }
      
      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }
  
  /**
   * Get order statistics for customer
   */
  async getCustomerOrderStats(groupId) {
    try {
      const orders = await Order.find({ group_id: groupId }).lean();
      
      const totalOrders = orders.length;
      const totalSpent = orders.reduce((sum, order) => {
        return sum + parseFloat(order.amount || 0);
      }, 0);
      const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
      
      // Get favorite items
      const productCounts = {};
      orders.forEach(order => {
        (order.line_items || []).forEach(item => {
          const productId = item.product;
          productCounts[productId] = (productCounts[productId] || 0) + (item.quantity || 1);
        });
      });
      
      const favoriteItems = Object.entries(productCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([productId, quantity]) => ({ 
          productId, 
          totalQuantity: quantity 
        }));
      
      return {
        totalOrders,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
        favoriteItems
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
      const query = {};
      
      if (filters.groupId) {
        query.group_id = filters.groupId;
      }
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.dateFrom && filters.dateTo) {
        query.created_at = {
          $gte: filters.dateFrom,
          $lte: filters.dateTo
        };
      }
      
      if (filters.minAmount || filters.maxAmount) {
        // Need to handle string amounts
        const orders = await Order.find(query).lean();
        return orders.filter(order => {
          const amount = parseFloat(order.amount || 0);
          if (filters.minAmount && amount < parseFloat(filters.minAmount)) return false;
          if (filters.maxAmount && amount > parseFloat(filters.maxAmount)) return false;
          return true;
        }).slice(0, filters.limit || 50);
      }
      
      const orders = await Order.find(query)
        .sort({ created_at: -1 })
        .limit(filters.limit || 50)
        .lean();
      
      return orders;
    } catch (error) {
      console.error('Error searching orders:', error);
      return [];
    }
  }
  
  /**
   * Cancel order
   */
  async cancelOrder(orderNumber, groupId, reason = '') {
    try {
      const order = await Order.findOne({ 
        order_number: orderNumber, 
        group_id: groupId 
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
    if (order.stripe_payment_intent && order.stripe_payment_intent !== '') {
      return 'paid';
    }
    if (order.payment_method && order.payment_method !== '') {
      return 'processing';
    }
    return 'pending';
  }
  
  calculateEstimatedDelivery(order) {
    if (order.status === 'delivered') {
      return null;
    }
    
    const now = new Date();
    let orderTime;
    
    try {
      orderTime = new Date(order.created_at);
    } catch (e) {
      orderTime = now;
    }
    
    const estimatedDelivery = new Date(orderTime.getTime() + (45 * 60 * 1000));
    
    if (estimatedDelivery < now) {
      return new Date(now.getTime() + (30 * 60 * 1000));
    }
    
    return estimatedDelivery;
  }
  
  formatOrderForDisplay(order) {
    const statusMessages = {
      'started': 'Order has been started',
      'pending': 'Order received and being processed',
      'confirmed': 'Order confirmed and being prepared',
      'preparing': 'Your order is being prepared',
      'ready': 'Order is ready for pickup/delivery',
      'out_for_delivery': 'Order is out for delivery',
      'delivered': 'Order has been delivered',
      'cancelled': 'Order was cancelled'
    };
    
    return {
      orderNumber: order.order_number,
      status: order.status,
      statusMessage: statusMessages[order.status] || order.status,
      amount: order.amount,
      createdAt: order.created_at,
      estimatedDelivery: this.calculateEstimatedDelivery(order),
      items: order.line_items || [],
      itemCount: order.line_items?.length || 0
    };
  }
}

const orderService = new OrderService();

module.exports = {
  OrderService,
  orderService,
  
  getOrderStatus: (orderNumber, groupId) => 
    orderService.getOrderStatus(orderNumber, groupId),
    
  getCustomerOrders: (groupId, limit, offset) => 
    orderService.getCustomerOrders(groupId, limit, offset),
    
  updateOrderStatus: (orderNumber, status, notes) => 
    orderService.updateOrderStatus(orderNumber, status, notes),
    
  createOrderFromCart: (groupId, cartItems, orderDetails) => 
    orderService.createOrderFromCart(groupId, cartItems, orderDetails),
    
  getCustomerOrderStats: (groupId) => 
    orderService.getCustomerOrderStats(groupId),
    
  searchOrders: (filters) => 
    orderService.searchOrders(filters),
    
  cancelOrder: (orderNumber, groupId, reason) => 
    orderService.cancelOrder(orderNumber, groupId, reason)
};