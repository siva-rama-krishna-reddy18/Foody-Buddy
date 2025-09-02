// controllers/orderController.js
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

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
        await prisma.order.update({
          where: { orderNumber: parseInt(orderNumber) },
          data: { status: statuses[currentIndex] }
        });
        
        console.log(`[Order] Order ${orderNumber} status updated to: ${statuses[currentIndex]}`);
        currentIndex++;
      } catch (error) {
        console.error(`[Order] Status update failed for ${orderNumber}:`, error);
        clearInterval(interval);
      }
    }, 10000); // Update every 30 seconds
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
      const cart = await prisma.carts.findFirst({
        where: { customer_id: customerId }
      });

      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          return res.status(404).json({
            success: false,
            error: `Product ${item.productId} not found`
          });
        }

        const itemTotal = parseFloat(product.price) * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: parseFloat(product.price)
        });
      }

      // Generate order number
      const orderNumber = Math.floor(100000 + Math.random() * 900000);

      // Create order with proper field mapping
      const order = await prisma.order.create({
        data: {
          orderNumber: orderNumber,
          amount: totalAmount,
          createdAt: new Date(),
          status: 'PENDING',
          paymentMethod: paymentMethod || 'CASH',
          customerId: customerId, // Ensure correct field name
          orderLineItems: {
            create: orderItems
          }
        },
        include: {
          orderLineItems: true
        }
      });

      // Add this to your main server file after the server starts
async function startProgressionForPendingOrders() {
  try {
    const pendingOrders = await prisma.order.findMany({
      where: { status: 'PENDING' },
      select: { orderNumber: true }
    });
    
    console.log(`[Server] Found ${pendingOrders.length} pending orders, starting progression...`);
    
    pendingOrders.forEach(order => {
      OrderController.simulateOrderProgress(order.orderNumber);
    });
  } catch (error) {
    console.error('Failed to start progression for pending orders:', error);
  }
}

// Call this after server startup
setTimeout(startProgressionForPendingOrders, 5000); // Wait 5 seconds after server start

      // Start automatic status progression
      OrderController.simulateOrderProgress(order.orderNumber);
      console.log(`[Order] Started auto-progression for order ${order.orderNumber}`);

      // Clear cart after successful order
      if (cart) {
        await prisma.cartItem.deleteMany({
          where: { cart_id: cart.id }
        });
        console.log(`[Order] Cart cleared for customer ${customerId}`);
      }

      res.json({
        success: true,
        data: {
          orderId: order.orderNumber, // Use orderNumber as ID
          orderNumber: order.orderNumber,
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

      // Try to get orders with proper field mapping
      const orders = await prisma.order.findMany({
        where: {
          customerId: customerId // Use correct field name
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          orderLineItems: {
            take: 3 // Limit items per order for summary
          }
        }
      });

      res.json({
        success: true,
        data: orders.map(order => ({
          orderNumber: order.orderNumber,
          amount: order.amount,
          status: order.status,
          createdAt: order.createdAt,
          itemCount: order.orderLineItems?.length || 0
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

      // Try orderNumber first (most likely primary key)
      let order = null;
      
      try {
        order = await prisma.order.findUnique({
          where: { orderNumber: parseInt(orderId) },
          include: {
            orderLineItems: true
          }
        });
      } catch (error1) {
        // If orderNumber fails, try other possible fields
        console.log('[Order] Trying alternative order lookup');
        
        // Skip direct ID lookup since it's not available in this schema
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

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

  // Update order status (can be used for manual override)
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

      const order = await prisma.order.update({
        where: { orderNumber: parseInt(orderId) },
        data: { status }
      });

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

      const order = await prisma.order.findUnique({
        where: { orderNumber: parseInt(orderId) }
      });

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

      const cancelledOrder = await prisma.order.update({
        where: { orderNumber: parseInt(orderId) },
        data: { status: 'CANCELLED' }
      });

      console.log(`[Order] Order ${orderId} cancelled`);

      res.json({
        success: true,
        data: cancelledOrder
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
      const product = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

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

      // Check if item already in cart
      const existingItem = await prisma.cartItem.findFirst({
        where: {
          cart_id: cart.id,
          productId: productId
        }
      });

      let cartItem;

      if (existingItem) {
        // Update quantity
        cartItem = await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { 
            quantity: existingItem.quantity + quantity,
            title: product.name, // Ensure name is set
            unit_price: parseFloat(product.price), // Ensure price is set
            updated_at: new Date()
          }
        });
      } else {
        // Add new item
        cartItem = await prisma.cartItem.create({
          data: {
            id: uuidv4(),
            cart_id: cart.id,
            productId: productId,
            title: product.name,
            unit_price: parseFloat(product.price),
            quantity: quantity,
            created_at: new Date(),
            updated_at: new Date()
          }
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

      // First, find the cart for this customer
      const cart = await prisma.carts.findFirst({
        where: { customer_id: customerId }
      });

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

      // Get cart items
      const cartItems = await prisma.cartItem.findMany({
        where: { cart_id: cart.id }
      });

      // Enrich items with product data if missing
      const enrichedItems = [];
      for (const item of cartItems) {
        let finalName = item.title;
        let finalPrice = item.unit_price;

        // Fetch product data if missing
        if (!finalName || !finalPrice) {
          try {
            const product = await prisma.product.findUnique({
              where: { id: item.productId }
            });
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
      const { customerId, productId, quantity } = req.body;

      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Quantity must be greater than 0'
        });
      }

      // Find customer's cart
      const cart = await prisma.carts.findFirst({
        where: { customer_id: customerId }
      });

      if (!cart) {
        return res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
      }

      const cartItem = await prisma.cartItem.updateMany({
        where: {
          cart_id: cart.id,
          productId: productId
        },
        data: { 
          quantity,
          updated_at: new Date()
        }
      });

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

      // Find customer's cart
      const cart = await prisma.carts.findFirst({
        where: { customer_id: customerId }
      });

      if (!cart) {
        return res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
      }

      await prisma.cartItem.deleteMany({
        where: {
          cart_id: cart.id,
          productId: productId
        }
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

      // Find customer's cart
      const cart = await prisma.carts.findFirst({
        where: { customer_id: customerId }
      });

      if (!cart) {
        return res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
      }

      await prisma.cartItem.deleteMany({
        where: { cart_id: cart.id }
      });

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

module.exports = OrderController;