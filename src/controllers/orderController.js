// src/controllers/orderController.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Cart = require('../../models/Cart');
const CartItem = require('../../models/CartItem');
const Product = require('../../models/Product');
const Order = require('../../models/Order');

class OrderController {
  // Automatic order status progression
  static async simulateOrderProgress(orderNumber) {
    const statuses = ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    let currentIndex = 0;
    
    console.log(`[Order] Starting automatic progression for order ${orderNumber}`);
    
    const interval = setInterval(async () => {
      if (currentIndex >= statuses.length) {
        console.log(`[Order] Order ${orderNumber} progression complete - DELIVERED`);
        clearInterval(interval);
        return;
      }
      
      try {
        const result = await Order.findOneAndUpdate(
          { order_number: orderNumber },
          { status: statuses[currentIndex] },
          { new: true }
        );
        
        if (result) {
          console.log(`[Order] Order ${orderNumber} status updated to: ${statuses[currentIndex]}`);
          console.log('[Order] Update result:', result);
        }
        currentIndex++;
      } catch (error) {
        console.error(`[Order] Status update failed for ${orderNumber}:`, error);
        clearInterval(interval);
      }
    }, 5000); // 5 seconds for faster demo
  }

  // Place a new order
  static async placeOrder(req, res) {
    try {
      const { customerId, items, deliveryAddress, paymentMethod, specialInstructions } = req.body;

      if (!customerId || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Customer ID and items are required'
        });
      }

      // Calculate total
      let totalAmount = 0;
      const orderItems = [];

      // Find customer's cart for clearing after order
      const cart = await Cart.findOne({ customer_id: customerId });

      for (const item of items) {
        const product = await Product.findOne({ id: item.productId });

        if (!product) {
          return res.status(404).json({
            success: false,
            error: `Product ${item.productId} not found`
          });
        }

        const itemTotal = parseFloat(product.price) * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          product: product.name,
          price: product.price.toString(),
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || ''
        });
      }

      // Generate order number
      const orderNumber = Math.floor(10000 + Math.random() * 90000);

      // Create order
      const order = await Order.create({
        _id: new mongoose.Types.ObjectId(),
        order_number: orderNumber,
        amount: totalAmount.toString(),
        created_at: new Date().toISOString(),
        currency: 'USD',
        date: new Date().toISOString(),
        group_id: customerId,
        line_items: orderItems,
        payment_method: paymentMethod || 'CASH',
        status: 'PENDING',
        orderNumberProvisional: orderNumber
      });

      // Start automatic status progression
      OrderController.simulateOrderProgress(order.order_number);
      console.log(`[Order] Started auto-progression for order ${order.order_number}`);

      // Clear cart after successful order
      if (cart) {
        await CartItem.deleteMany({ cart_id: cart.id });
        console.log(`[Order] Cart cleared for customer ${customerId}`);
      }

      res.json({
        success: true,
        data: {
          orderId: order.order_number,
          orderNumber: order.order_number,
          totalAmount,
          status: order.status,
          estimatedDelivery: '30-45 minutes',
          message: 'Order placed successfully! Status will update automatically.'
        }
      });

    } catch (error) {
      console.error('Place order error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to place order: ' + error.message
      });
    }
  }

  // Get order history
  static async getOrderHistory(req, res) {
    try {
      const { customerId } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      const orders = await Order.find({ group_id: customerId })
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .lean();

      res.json({
        success: true,
        data: orders.map(order => ({
          orderNumber: order.order_number,
          amount: order.amount,
          status: order.status,
          createdAt: order.created_at,
          itemCount: order.line_items?.length || 0
        }))
      });

    } catch (error) {
      console.error('Get order history error:', error);
      res.json({
        success: true,
        data: [],
        message: 'Order history temporarily unavailable'
      });
    }
  }

  // Get specific order details
  static async getOrderDetails(req, res) {
    try {
      const { orderId } = req.params;

      const order = await Order.findOne({ order_number: parseInt(orderId) }).lean();

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      res.json({
        success: true,
        data: order
      });

    } catch (error) {
      console.error('Get order details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order details'
      });
    }
  }

  // Update order status
  static async updateOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      const validStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status'
        });
      }

      const order = await Order.findOneAndUpdate(
        { order_number: parseInt(orderId) },
        { status },
        { new: true }
      );

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      console.log(`[Order] Manual status update: Order ${orderId} → ${status}`);

      res.json({
        success: true,
        data: order
      });

    } catch (error) {
      console.error('Update order status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update order status'
      });
    }
  }

  // Cancel order
  static async cancelOrder(req, res) {
    try {
      const { orderId } = req.params;

      const order = await Order.findOne({ order_number: parseInt(orderId) });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
        return res.status(400).json({
          success: false,
          error: 'Cannot cancel this order'
        });
      }

      order.status = 'CANCELLED';
      await order.save();

      console.log(`[Order] Order ${orderId} cancelled`);

      res.json({
        success: true,
        data: order
      });

    } catch (error) {
      console.error('Cancel order error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel order'
      });
    }
  }

  // Add item to cart
  static async addToCart(req, res) {
    try {
      const { customerId, productId, quantity = 1 } = req.body;

      if (!customerId || !productId) {
        return res.status(400).json({
          success: false,
          error: 'Customer ID and Product ID are required'
        });
      }

      // Check if product exists
      const product = await Product.findOne({ id: productId });

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      // Find or create cart
      let cart = await Cart.findOne({ customer_id: customerId });

      if (!cart) {
        cart = await Cart.create({
          id: uuidv4(),
          customer_id: customerId,
          session_id: uuidv4(),
          status: 'OPEN',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      // Check if item already in cart
      const existingItem = await CartItem.findOne({
        cart_id: cart.id,
        productId: productId
      });

      let cartItem;

      if (existingItem) {
        // Update quantity
        existingItem.quantity += quantity;
        existingItem.title = product.name;
        existingItem.unit_price = parseFloat(product.price);
        existingItem.updated_at = new Date();
        cartItem = await existingItem.save();
      } else {
        // Add new item
        cartItem = await CartItem.create({
          id: uuidv4(),
          cart_id: cart.id,
          productId: productId,
          title: product.name,
          unit_price: parseFloat(product.price),
          quantity: quantity,
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      res.json({
        success: true,
        data: cartItem
      });

    } catch (error) {
      console.error('Add to cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add item to cart'
      });
    }
  }

  // Get cart
  static async getCart(req, res) {
    try {
      const { customerId } = req.params;

      const cart = await Cart.findOne({ customer_id: customerId });

      if (!cart) {
        return res.json({
          success: true,
          data: {
            items: [],
            total: 0,
            itemCount: 0
          }
        });
      }

      const cartItems = await CartItem.find({ cart_id: cart.id }).lean();

      // Enrich items with product data if missing
      const enrichedItems = [];
      for (const item of cartItems) {
        let finalName = item.title;
        let finalPrice = item.unit_price;

        if (!finalName || !finalPrice) {
          try {
            const product = await Product.findOne({ id: item.productId });
            if (product) {
              finalName = finalName || product.name;
              finalPrice = finalPrice || parseFloat(product.price);
            }
          } catch (productError) {
            console.error('Product lookup failed:', productError);
          }
        }

        enrichedItems.push({
          id: item.id,
          productId: item.productId,
          name: finalName || 'Unknown Product',
          price: finalPrice || 0,
          quantity: item.quantity,
          total: (finalPrice || 0) * item.quantity
        });
      }

      const total = enrichedItems.reduce((sum, item) => sum + item.total, 0);
      const itemCount = enrichedItems.reduce((sum, item) => sum + item.quantity, 0);

      res.json({
        success: true,
        data: {
          items: enrichedItems,
          total: parseFloat(total.toFixed(2)),
          itemCount: itemCount
        }
      });

    } catch (error) {
      console.error('Get cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch cart'
      });
    }
  }

  // Update cart item quantity
  static async updateCartItem(req, res) {
    try {
      const { customerId, productId, quantity, cartItemId } = req.body;

      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Quantity must be greater than 0'
        });
      }

      // If cartItemId is provided, use it directly
      if (cartItemId) {
        const cartItem = await CartItem.findOneAndUpdate(
          { id: cartItemId },
          { 
            quantity,
            updated_at: new Date()
          },
          { new: true }
        );

        return res.json({
          success: true,
          data: cartItem
        });
      }

      // Otherwise, find by customer and product
      const cart = await Cart.findOne({ customer_id: customerId });

      if (!cart) {
        return res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
      }

      const cartItem = await CartItem.findOneAndUpdate(
        {
          cart_id: cart.id,
          productId: productId
        },
        { 
          quantity,
          updated_at: new Date()
        },
        { new: true }
      );

      res.json({
        success: true,
        data: cartItem
      });

    } catch (error) {
      console.error('Update cart item error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update cart item'
      });
    }
  }

  // Remove item from cart
  static async removeFromCart(req, res) {
    try {
      const { customerId, productId } = req.params;

      const cart = await Cart.findOne({ customer_id: customerId });

      if (!cart) {
        return res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
      }

      await CartItem.deleteMany({
        cart_id: cart.id,
        productId: productId
      });

      res.json({
        success: true,
        message: 'Item removed from cart'
      });

    } catch (error) {
      console.error('Remove from cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove item from cart'
      });
    }
  }

  // Clear entire cart
  static async clearCart(req, res) {
    try {
      const { customerId } = req.params;

      const cart = await Cart.findOne({ customer_id: customerId });

      if (!cart) {
        return res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
      }

      await CartItem.deleteMany({ cart_id: cart.id });

      res.json({
        success: true,
        message: 'Cart cleared'
      });

    } catch (error) {
      console.error('Clear cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cart'
      });
    }
  }
}

// Start progression for pending orders on server startup
async function startProgressionForPendingOrders() {
  try {
    const pendingOrders = await Order.find({ status: 'PENDING' }).select('order_number');
    
    console.log(`[Server] Found ${pendingOrders.length} pending orders, starting progression...`);
    
    pendingOrders.forEach(order => {
      OrderController.simulateOrderProgress(order.order_number);
    });
  } catch (error) {
    console.error('Failed to start progression for pending orders:', error);
  }
}

// Export the startup function
OrderController.startProgressionForPendingOrders = startProgressionForPendingOrders;

module.exports = OrderController;