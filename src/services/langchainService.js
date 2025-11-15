// src/services/langchainService.js
// ✅ FIXED: Proper token limits + Dynamic real-time context + Agent-like behavior

const { Ollama } = require("langchain/llms/ollama");
const { BufferMemory } = require("langchain/memory");
const { DynamicTool } = require("langchain/tools");
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const nodemailer = require('nodemailer');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral:7b-instruct';

// Business Configuration
const BUSINESS_CONFIG = {
  TAX_RATE: 0.08,
  MIN_ORDER_AMOUNT: 5.00,
  DELIVERY_ZONES: ['Fort Lauderdale', 'Miami', 'Boca Raton', 'Hollywood', 'Pompano Beach'],
  ESTIMATED_DELIVERY_TIME: 35,
};

const appliedCoupons = new Map();

console.log('[LangChain] Clearing all stored coupons on startup');
appliedCoupons.clear();

// ============================================================================
// TOOL 1: Menu Search Tool
// ============================================================================
function createMenuSearchTool(searchFunction) {
  return new DynamicTool({
    name: "menu_search",
    description: "Search restaurant menu for available items. Use this when customers ask about food, menu items, or what's available.",
    func: async (input) => {
      try {
        console.log('[MenuSearchTool] Searching:', input);
        const results = await searchFunction(input, 10);
        
        return JSON.stringify({
          success: true,
          itemCount: results.length,
          items: results.map(r => ({
            id: r.id,
            name: r.name,
            price: r.price,
            description: r.description || '',
            image: r.image || r.imageUrl || '',
            available: r.available !== false,
            stock: r.stock || 'available'
          }))
        });
      } catch (error) {
        console.error('[MenuSearchTool] Error:', error);
        return JSON.stringify({ success: false, error: error.message, items: [] });
      }
    }
  });
}

// ============================================================================
// TOOL 2: Cart Operations Tool
// ============================================================================
function createCartTool(agentService) {
  return new DynamicTool({
    name: "cart_operations",
    description: "Manage shopping cart - add items, remove items, view cart contents. Use this for cart-related operations.",
    func: async (input) => {
      try {
        const params = JSON.parse(input);
        const { action, customerId, productId, quantity } = params;

        if (!customerId) throw new Error('customerId required');

        switch (action) {
          case 'view':
            const cart = await agentService.getCart(customerId);
            
            return JSON.stringify({
              success: true,
              action: 'view',
              cart: {
                itemCount: cart.itemCount || 0,
                total: cart.total,
                subtotal: cart.total,
                discount: 0,
                coupon: null,
                items: (cart.items || []).map(item => ({
                  id: item.id,
                  productId: item.productId,
                  title: item.name,
                  name: item.name,
                  price: item.price,
                  unit_price: item.price,
                  quantity: item.quantity,
                  image: item.image || ''
                }))
              }
            });

          case 'add':
            if (!productId) throw new Error('productId required');
            
            const Product = require('../../models/Product');
            const product = await Product.findById(productId);
            
            if (!product) {
              return JSON.stringify({
                success: false,
                error: 'Product not found'
              });
            }
            
            if (!product.available) {
              return JSON.stringify({
                success: false,
                error: `${product.name} is currently unavailable`
              });
            }
            
            if (product.stock !== undefined && product.stock <= 0) {
              return JSON.stringify({
                success: false,
                error: `${product.name} is out of stock`
              });
            }
            
            await agentService.addItemToCart(customerId, productId, quantity || 1);
            const updatedCart = await agentService.getCart(customerId);
            
            return JSON.stringify({
              success: true,
              action: 'add',
              message: `Added ${product.name} to cart`,
              productName: product.name, // ✅ Added for context
              cart: {
                itemCount: updatedCart.itemCount,
                total: updatedCart.total,
                subtotal: updatedCart.total,
                discount: 0,
                coupon: null,
                items: updatedCart.items.map(item => ({
                  id: item.id,
                  productId: item.productId,
                  title: item.name,
                  name: item.name,
                  price: item.price,
                  unit_price: item.price,
                  quantity: item.quantity,
                  image: item.image || ''
                }))
              }
            });

          case 'remove':
            if (!productId) throw new Error('productId required');
            
            await agentService.removeItemFromCart(customerId, productId, quantity);
            const cartAfterRemove = await agentService.getCart(customerId);
            
            return JSON.stringify({ 
              success: true, 
              action: 'remove', 
              message: quantity ? `Removed ${quantity} item(s) from cart` : 'Removed item from cart',
              cart: {
                itemCount: cartAfterRemove.itemCount,
                total: cartAfterRemove.total,
                subtotal: cartAfterRemove.total,
                discount: 0,
                coupon: null,
                items: cartAfterRemove.items.map(item => ({
                  id: item.id,
                  productId: item.productId,
                  title: item.name,
                  name: item.name,
                  price: item.price,
                  unit_price: item.price,
                  quantity: item.quantity,
                  image: item.image || ''
                }))
              }
            });

          case 'clear':
            await agentService.clearCartItems(customerId);
            appliedCoupons.delete(customerId);
            return JSON.stringify({ success: true, action: 'clear', message: 'Cart cleared' });

          default:
            return JSON.stringify({ success: false, error: 'Invalid action' });
        }
      } catch (error) {
        console.error('[CartTool] Error:', error);
        return JSON.stringify({ success: false, error: error.message });
      }
    }
  });
}

// ============================================================================
// TOOL 3: Order Operations Tool
// ============================================================================
function createOrderTool() {
  return new DynamicTool({
    name: "order_operations",
    description: "Handle order tracking, order history, and order details. Use this when customers ask about their orders.",
    func: async (input) => {
      try {
        const params = JSON.parse(input);
        const { action, customerId, orderNumber, orderData } = params;

        if (!customerId) throw new Error('customerId required');

        const mapStatus = (status) => {
          const statusMap = {
            'CONFIRMED': 'preparing',
            'PREPARING': 'preparing',
            'READY': 'ready',
            'OUT_FOR_DELIVERY': 'out_for_delivery',
            'DELIVERED': 'delivered',
            'CANCELLED': 'cancelled'
          };
          return statusMap[status?.toUpperCase()] || 'preparing';
        };

        switch (action) {
          case 'list':
            const orders = await Order.find({ 
              $or: [{ group_id: customerId }, { customer_id: customerId }] 
            })
            .sort({ created_at: -1 })
            .limit(10)
            .lean();
            
            return JSON.stringify({
              success: true,
              orderCount: orders.length,
              orders: orders.map(o => ({
                orderNumber: o.order_number,
                status: mapStatus(o.status),
                total: parseFloat(o.amount || 0),
                date: o.created_at,
                discount: o.discount_amount ? parseFloat(o.discount_amount) : null,
                couponCode: o.coupon_code || null,
                originalAmount: o.original_amount ? parseFloat(o.original_amount) : null,
                items: (o.line_items || []).map(item => ({
                  name: item.product || item.title || 'Unknown Item',
                  quantity: item.quantity || 1,
                  price: parseFloat(item.price || 0),
                  specialInstructions: item.specialInstructions || null
                }))
              }))
            });

          case 'track':
            if (!orderNumber) throw new Error('orderNumber required');
            
            const order = await Order.findOne({ 
              order_number: parseInt(orderNumber),
              $or: [{ group_id: customerId }, { customer_id: customerId }] 
            }).lean();
            
            if (!order) {
              return JSON.stringify({ success: false, error: 'Order not found' });
            }
            
            return JSON.stringify({
              success: true,
              order: {
                orderNumber: order.order_number,
                status: mapStatus(order.status),
                total: parseFloat(order.amount || 0),
                date: order.created_at,
                discount: order.discount_amount ? parseFloat(order.discount_amount) : null,
                couponCode: order.coupon_code || null,
                originalAmount: order.original_amount ? parseFloat(order.original_amount) : null,
                items: (order.line_items || []).map(item => ({
                  name: item.product || item.title || 'Unknown Item',
                  quantity: item.quantity || 1,
                  price: parseFloat(item.price || 0),
                  specialInstructions: item.specialInstructions || null
                }))
              }
            });

          case 'calculate_total':
            if (!orderData || !orderData.items) throw new Error('orderData with items required');
            
            let subtotal = 0;
            for (const item of orderData.items) {
              subtotal += (item.price || 0) * (item.quantity || 1);
            }
            
            const tax = subtotal * BUSINESS_CONFIG.TAX_RATE;
            const total = subtotal + tax;
            
            return JSON.stringify({
              success: true,
              subtotal: parseFloat(subtotal.toFixed(2)),
              tax: parseFloat(tax.toFixed(2)),
              total: parseFloat(total.toFixed(2)),
              taxRate: BUSINESS_CONFIG.TAX_RATE
            });

          default:
            return JSON.stringify({ success: false, error: 'Invalid action' });
        }
      } catch (error) {
        console.error('[OrderTool] Error:', error);
        return JSON.stringify({ success: false, error: error.message });
      }
    }
  });
}

// ============================================================================
// TOOL 4: Coupon Operations Tool
// ============================================================================
function createCouponTool(agentService) {
  return new DynamicTool({
    name: "coupon_operations",
    description: "Apply or remove discount coupons. Use this when customers mention coupon codes.",
    func: async (input) => {
      try {
        const params = JSON.parse(input);
        const { action, customerId, couponCode } = params;

        if (!customerId) throw new Error('customerId required');

        switch (action) {
          case 'apply':
            if (!couponCode) throw new Error('couponCode required');
            
            console.log('[CouponTool] Applying coupon:', couponCode);
            
            const coupons = {
              'SAVE10': { discount: 10, type: 'percentage', code: 'SAVE10', description: '10% off your order' },
              'SAVE20': { discount: 20, type: 'percentage', code: 'SAVE20', description: '20% off your order' },
              'FLAT5': { discount: 5, type: 'fixed', code: 'FLAT5', description: '$5 off your order' },
              'FIRST': { discount: 15, type: 'percentage', code: 'FIRST', description: '15% off first order' }
            };
            
            const coupon = coupons[couponCode.toUpperCase()];
            
            if (!coupon) {
              return JSON.stringify({
                success: false,
                error: 'Invalid coupon code. Try SAVE10, SAVE20, FLAT5, or FIRST'
              });
            }
            
            appliedCoupons.set(customerId, coupon);
            console.log('[CouponTool] ✅ Stored coupon for customer:', customerId);
            
            const cart = await agentService.getCart(customerId);
            
            let discountAmount = 0;
            if (coupon.type === 'percentage') {
              discountAmount = (cart.total * coupon.discount) / 100;
            } else {
              discountAmount = coupon.discount;
            }
            
            const newTotal = Math.max(0, cart.total - discountAmount);
            
            return JSON.stringify({
              success: true,
              action: 'apply',
              message: `Coupon ${coupon.code} applied successfully!`,
              coupon: {
                code: coupon.code,
                discount: coupon.discount,
                type: coupon.type,
                description: coupon.description,
                discountAmount: parseFloat(discountAmount.toFixed(2)),
                originalTotal: cart.total,
                newTotal: parseFloat(newTotal.toFixed(2))
              },
              cart: {
                itemCount: cart.itemCount,
                total: parseFloat(newTotal.toFixed(2)),
                subtotal: cart.total,
                discount: parseFloat(discountAmount.toFixed(2)),
                coupon: coupon,
                items: cart.items
              }
            });

          case 'remove':
            appliedCoupons.delete(customerId);
            console.log('[CouponTool] Removed coupon for customer:', customerId);
            
            return JSON.stringify({
              success: true,
              action: 'remove',
              message: 'Coupon removed successfully'
            });

          default:
            return JSON.stringify({ success: false, error: 'Invalid action' });
        }
      } catch (error) {
        console.error('[CouponTool] Error:', error);
        return JSON.stringify({ success: false, error: error.message });
      }
    }
  });
}

// ============================================================================
// TOOL 5-8: Email, Payment, Inventory, Business Rules Tools (Keep as is)
// ============================================================================
function createEmailTool() {
  return new DynamicTool({
    name: "send_email",
    description: "Send order confirmation emails to customers after successful orders.",
    func: async (input) => {
      try {
        const { recipient, subject, orderDetails } = JSON.parse(input);
        
        if (!recipient) throw new Error('recipient email required');
        if (!orderDetails) throw new Error('orderDetails required');
        
        console.log('[EmailTool] Sending email to:', recipient);
        
        const transporter = nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
        
        const emailContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #ff6b35; color: white; padding: 20px; text-align: center; }
              .content { background-color: #f9f9f9; padding: 20px; }
              .order-item { padding: 10px; border-bottom: 1px solid #ddd; }
              .total { font-size: 18px; font-weight: bold; color: #ff6b35; margin-top: 20px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🍔 Order Confirmation</h1>
              </div>
              <div class="content">
                <h2>Thank you for your order!</h2>
                <p><strong>Order Number:</strong> ${orderDetails.orderNumber || 'N/A'}</p>
                <p><strong>Order Date:</strong> ${new Date().toLocaleString()}</p>
                
                <h3>Order Details:</h3>
                ${orderDetails.items.map(item => `
                  <div class="order-item">
                    <strong>${item.quantity}x ${item.name}</strong> - $${(item.price * item.quantity).toFixed(2)}
                    ${item.specialInstructions ? `<br><small>Note: ${item.specialInstructions}</small>` : ''}
                  </div>
                `).join('')}
                
                <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 5px;">
                  <p style="margin: 5px 0;">Subtotal: $${orderDetails.subtotal?.toFixed(2) || orderDetails.total.toFixed(2)}</p>
                  ${orderDetails.discount ? `<p style="margin: 5px 0; color: green;">Discount: -$${orderDetails.discount.toFixed(2)}</p>` : ''}
                  ${orderDetails.tax ? `<p style="margin: 5px 0;">Tax (8%): $${orderDetails.tax.toFixed(2)}</p>` : ''}
                  <p class="total">Total: $${orderDetails.total.toFixed(2)}</p>
                </div>
                
                <p style="margin-top: 20px;">
                  <strong>Estimated Delivery:</strong> ${BUSINESS_CONFIG.ESTIMATED_DELIVERY_TIME} minutes
                </p>
              </div>
              <div class="footer">
                <p>FoodyBuddy - Your Personal Food Ordering Assistant</p>
              </div>
            </div>
          </body>
          </html>
        `;
        
        const mailOptions = {
          from: `FoodyBuddy <${process.env.EMAIL_USER}>`,
          to: recipient,
          subject: subject || `Order Confirmation #${orderDetails.orderNumber}`,
          html: emailContent
        };
        
        const result = await transporter.sendMail(mailOptions);
        
        console.log('[EmailTool] Email sent successfully:', result.messageId);
        
        return JSON.stringify({
          success: true,
          messageId: result.messageId,
          message: 'Order confirmation email sent successfully',
          recipient: recipient
        });
        
      } catch (error) {
        console.error('[EmailTool] Error:', error);
        return JSON.stringify({ 
          success: false, 
          error: error.message,
          message: 'Failed to send email. Order is still confirmed.' 
        });
      }
    }
  });
}

function createPaymentTool() {
  return new DynamicTool({
    name: "process_payment",
    description: "Process customer payments (demo mode).",
    func: async (input) => {
      try {
        const { amount, customerEmail, orderData } = JSON.parse(input);
        
        if (!amount || amount <= 0) throw new Error('Valid amount required');
        
        console.log('[PaymentTool] Processing DEMO payment:', {
          amount: `$${amount.toFixed(2)}`,
          customerEmail: customerEmail || 'N/A'
        });
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const mockPaymentIntentId = `pi_demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const paymentMethods = [
          { method: 'card', brand: 'Visa', last4: '4242' },
          { method: 'card', brand: 'Mastercard', last4: '5555' },
          { method: 'card', brand: 'Amex', last4: '3782' }
        ];
        const selectedMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
        
        console.log('[PaymentTool] DEMO Payment processed successfully');
        
        return JSON.stringify({
          success: true,
          demo: true,
          paymentIntentId: mockPaymentIntentId,
          amount: parseFloat(amount.toFixed(2)),
          status: 'succeeded',
          currency: 'usd',
          paymentMethod: selectedMethod.method,
          last4: selectedMethod.last4,
          brand: selectedMethod.brand,
          message: `Payment successful! Paid $${amount.toFixed(2)} with ${selectedMethod.brand} ending in ${selectedMethod.last4}`,
          receipt: {
            orderNumber: orderData?.orderNumber || 'N/A',
            amount: parseFloat(amount.toFixed(2)),
            paymentDate: new Date().toISOString(),
            paymentId: mockPaymentIntentId,
            status: 'paid',
            customerEmail: customerEmail || 'N/A'
          }
        });
        
      } catch (error) {
        console.error('[PaymentTool] Error:', error);
        return JSON.stringify({ 
          success: false,
          demo: true,
          error: error.message,
          message: 'Payment processing failed (Demo Mode).' 
        });
      }
    }
  });
}

function createInventoryTool() {
  return new DynamicTool({
    name: "check_inventory",
    description: "Check product availability and stock levels.",
    func: async (input) => {
      try {
        const { productId, productName } = JSON.parse(input);
        
        let product;
        
        if (productId) {
          product = await Product.findById(productId);
        } else if (productName) {
          product = await Product.findOne({ 
            name: { $regex: productName, $options: 'i' } 
          });
        } else {
          throw new Error('productId or productName required');
        }
        
        if (!product) {
          return JSON.stringify({ 
            success: false, 
            error: 'Product not found',
            available: false
          });
        }
        
        const isAvailable = product.available !== false && 
                           (product.stock === undefined || product.stock > 0);
        
        const stockMessage = product.stock === undefined 
          ? 'In stock' 
          : product.stock > 10 
            ? 'In stock' 
            : product.stock > 0 
              ? `Only ${product.stock} left!` 
              : 'Out of stock';
        
        return JSON.stringify({
          success: true,
          productId: product._id,
          name: product.name,
          price: product.price,
          available: isAvailable,
          stock: product.stock || 'unlimited',
          stockMessage: stockMessage,
          message: isAvailable 
            ? `${product.name} is ${stockMessage.toLowerCase()}` 
            : `${product.name} is currently unavailable`
        });
        
      } catch (error) {
        console.error('[InventoryTool] Error:', error);
        return JSON.stringify({ 
          success: false, 
          error: error.message,
          available: false
        });
      }
    }
  });
}

function createBusinessRulesTool() {
  return new DynamicTool({
    name: "validate_business_rules",
    description: "Validate minimum order amount and delivery zones.",
    func: async (input) => {
      try {
        const { orderTotal, deliveryAddress, itemCount } = JSON.parse(input);
        
        const validationResults = {
          passed: true,
          errors: [],
          warnings: []
        };
        
        if (orderTotal < BUSINESS_CONFIG.MIN_ORDER_AMOUNT) {
          validationResults.passed = false;
          validationResults.errors.push(
            `Minimum order amount is $${BUSINESS_CONFIG.MIN_ORDER_AMOUNT.toFixed(2)}. Your cart is $${orderTotal.toFixed(2)}.`
          );
        }
        
        if (!itemCount || itemCount === 0) {
          validationResults.passed = false;
          validationResults.errors.push('Your cart is empty. Please add items before checkout.');
        }
        
        console.log('[BusinessRules] Validation:', validationResults);
        
        return JSON.stringify({
          success: validationResults.passed,
          passed: validationResults.passed,
          errors: validationResults.errors,
          warnings: validationResults.warnings,
          config: {
            minOrderAmount: BUSINESS_CONFIG.MIN_ORDER_AMOUNT,
            deliveryZones: BUSINESS_CONFIG.DELIVERY_ZONES,
            taxRate: BUSINESS_CONFIG.TAX_RATE
          },
          message: validationResults.passed 
            ? 'All business rules validated successfully' 
            : 'Validation failed: ' + validationResults.errors.join(' ')
        });
        
      } catch (error) {
        console.error('[BusinessRulesTool] Error:', error);
        return JSON.stringify({ 
          success: false, 
          passed: false,
          error: error.message 
        });
      }
    }
  });
}

// ============================================================================
// MAIN LANGCHAIN AGENT CLASS - ✅ FIXED WITH REAL-TIME CONTEXT
// ============================================================================
class LangChainAgent {
  constructor(agentService, searchSimilar) {
    this.agentService = agentService;
    this.searchSimilar = searchSimilar;
    this.sessions = new Map();
    this.llm = null;
    this.tools = [];
    this.initialized = false;
    this.specialInstructionsStore = new Map();
    this.lastSearchResults = new Map();
    this.lastSearchTimestamp = new Map();
    this.conversationContext = new Map();
  }

  async initialize() {
    if (this.initialized) return;
    
    console.log('[LangChain] Initializing...');
    console.log('[LangChain] Ollama URL:', OLLAMA_BASE_URL);
    console.log('[LangChain] Model:', OLLAMA_MODEL);

    try {
      // ✅ FIX #1: Optimized for faster, complete responses
      this.llm = new Ollama({
        baseUrl: OLLAMA_BASE_URL,
        model: OLLAMA_MODEL,
        temperature: 0.7,        // ✅ Lower for more focused, faster responses
        numPredict: 80,          // ✅ CHANGED from 150 to 80 for speed (still complete)
        numCtx: 2048,            // ✅ NEW: Smaller context window = much faster
        topK: 40,
        topP: 0.85,              // ✅ Lower for more deterministic, faster
        repeatPenalty: 1.1,      // ✅ Lower for natural flow
        stop: ['\nCustomer:', '\nUser:', '\n\n', 'Customer:', 'User:'], // ✅ Better stop tokens
      });

      await this.llm.call("test");
      console.log('[LangChain] Ollama connected');

      this.tools = [
        createMenuSearchTool(this.searchSimilar),
        createCartTool(this.agentService),
        createOrderTool(),
        createCouponTool(this.agentService),
        createEmailTool(),
        createPaymentTool(),
        createInventoryTool(),
        createBusinessRulesTool()
      ];

      this.initialized = true;
      console.log('[LangChain] Initialized with', this.tools.length, 'tools');
      console.log('[LangChain] Available tools:', this.tools.map(t => t.name).join(', '));
    } catch (error) {
      console.error('[LangChain] Init failed:', error.message);
      throw error;
    }
  }

  getOrCreateMemory(customerId) {
    if (!this.sessions.has(customerId)) {
      this.sessions.set(customerId, new BufferMemory({
        memoryKey: "chat_history",
        returnMessages: true
      }));
    }
    return this.sessions.get(customerId);
  }

  buildAgentContext(customerId, message, toolUsage, cartData) {
    const context = this.conversationContext.get(customerId) || {
      hasGreeted: false,
      shownMenu: false,
      itemsAdded: 0,
      lastItemAdded: null,
      askedAboutPreferences: false,
      suggestedCheckout: false,
      offeredDrinks: false,
      offeredSides: false
    };

    // Update based on tools used
    if (toolUsage.tools.includes('menu_search')) {
      context.shownMenu = true;
    }
    
    if (toolUsage.tools.includes('cart_operations')) {
      const addResult = toolUsage.results.find(r => r.action === 'add');
      if (addResult && addResult.productName) {
        context.itemsAdded++;
        context.lastItemAdded = addResult.productName;
      }
    }

    this.conversationContext.set(customerId, context);
    return context;
  }

  generateSmartSuggestions(context, cartData, lastTool) {
    const suggestions = [];

    // No items in cart
    if (!cartData || !cartData.items || cartData.items.length === 0) {
      if (!context.shownMenu) {
        suggestions.push("🍽️ What's on the menu?");
        suggestions.push("🌟 Show me popular items");
      } else {
        suggestions.push("➕ Add items to cart");
        suggestions.push("🔍 Search for something else");
      }
      return suggestions;
    }

    // Has items
    if (cartData.items.length > 0) {
      if (context.itemsAdded === 1 && !context.offeredDrinks) {
        suggestions.push("🍹 Add drinks?");
        context.offeredDrinks = true;
      }
      
      if (!context.suggestedCheckout && cartData.items.length >= 2) {
        suggestions.push("✅ Ready to checkout?");
        context.suggestedCheckout = true;
      }
      
      suggestions.push("➕ Add more items");
      suggestions.push("🎟️ Apply coupon");
    }

    return suggestions.slice(0, 3);
  }

  // ✅ FIX #2: Enhanced chat method with REAL-TIME context
  async chat(customerId, message) {
    try {
      if (!this.initialized) await this.initialize();

      const memory = this.getOrCreateMemory(customerId);
      
      // ✅ Detect tools FIRST
      const toolUsage = await this.detectToolUsage(customerId, message);
      
      // ✅ FIX #3: Get REAL-TIME cart data
      const cartTool = this.tools.find(t => t.name === 'cart_operations');
      let cartData = null;
      let hasItems = false;
      let itemCount = 0;
      let cartTotal = 0;
      
      if (cartTool) {
        try {
          const cartResult = await cartTool.func(JSON.stringify({ action: 'view', customerId }));
          const parsed = JSON.parse(cartResult);
          cartData = parsed.cart;
          hasItems = cartData?.items?.length > 0;
          itemCount = cartData?.itemCount || 0;
          cartTotal = cartData?.total || 0;
          
          console.log('[LangChain] 📊 Real-time cart state:', {
            hasItems,
            itemCount,
            cartTotal: `$${cartTotal.toFixed(2)}`,
            items: hasItems ? cartData.items.map(i => i.name).join(', ') : 'empty'
          });
        } catch (e) {
          console.error('[LangChain] Error getting cart:', e);
        }
      }

      // ✅ FIX #4: Build DYNAMIC context based on ACTUAL state
      let systemPrompt = `You are FoodyBuddy, a friendly food ordering assistant.

CURRENT CART STATUS:`;

      if (hasItems) {
        const itemNames = cartData.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
        systemPrompt += `
- ${itemCount} item(s) in cart
- Total: $${cartTotal.toFixed(2)}
- Items: ${itemNames}`;
      } else {
        systemPrompt += `
- Cart is EMPTY`;
      }

      // ✅ Add what JUST happened
      if (toolUsage.results?.[0]) {
        const r = toolUsage.results[0];
        
        if (r.action === 'add' && r.productName) {
          systemPrompt += `\n\n✅ JUST NOW: You added ${r.productName} to their cart`;
          systemPrompt += `\nYOUR RESPONSE: Confirm it was added, suggest drinks or sides to go with it (1-2 sentences)`;
        } else if (r.action === 'view') {
          systemPrompt += `\n\n✅ JUST NOW: Customer asked to see their cart`;
          if (hasItems) {
            systemPrompt += `\nYOUR RESPONSE: Confirm what's in cart, ask if they want to add more or checkout (1-2 sentences)`;
          } else {
            systemPrompt += `\nYOUR RESPONSE: Let them know cart is empty, suggest browsing menu (1-2 sentences)`;
          }
        } else if (r.action === 'remove') {
          systemPrompt += `\n\n✅ JUST NOW: Customer removed an item`;
          systemPrompt += `\nYOUR RESPONSE: Confirm item removed, suggest adding something else (1-2 sentences)`;
        } else if (r.items?.length > 0) {
          systemPrompt += `\n\n✅ JUST NOW: You showed ${r.items.length} menu items`;
          systemPrompt += `\nYOUR RESPONSE: Briefly describe what you found, ask which they'd like (1-2 sentences)`;
        } else if (r.orders) {
          systemPrompt += `\n\n✅ JUST NOW: Showing order history`;
          systemPrompt += `\nYOUR RESPONSE: Summarize their orders briefly (1-2 sentences)`;
        } else if (r.coupon) {
          systemPrompt += `\n\n✅ JUST NOW: Applied coupon ${r.coupon.code}`;
          systemPrompt += `\nYOUR RESPONSE: Confirm savings, suggest proceeding to checkout (1-2 sentences)`;
        }
      }

      systemPrompt += `\n\nCustomer said: "${message}"

RULES:
- Be warm and conversational (like a friendly waiter)
- Keep it SHORT (2-3 sentences maximum)
- ALWAYS end with a question or suggestion
- Use casual language, occasional emoji (max 1)
- Don't repeat information they already know

Respond naturally:`;

      console.log('[LangChain] 💬 Generating response with real-time context...');

      let response;
      try {
        const responsePromise = this.llm.call(systemPrompt);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 15000) // ✅ Reduced from 25s to 15s for faster fallback
        );
        
        response = await Promise.race([responsePromise, timeoutPromise]);
        
      } catch (error) {
        console.log('[LangChain] ⏱️ Timeout, using context-aware fallback');
        
        const lower = message.toLowerCase();
        
        // ✅ PROACTIVE: Context-aware fallbacks based on user intent
        
        // Coupon request
        if (lower.includes('coupon') || lower.includes('discount') || lower.includes('promo')) {
          response = "Sure! We have SAVE10 (10% off), SAVE20 (20% off), FLAT5 ($5 off), or FIRST (15% off). Which would you like to use?";
        }
        // Checkout request with items
        else if ((lower.includes('checkout') || lower.includes('pay') || lower === 'yes') && hasItems) {
          response = `Perfect! You've got ${itemCount} items totaling $${cartTotal.toFixed(2)}. Let me process that for you! ✨`;
        }
        // Greeting
        else if (lower.includes('hi') || lower.includes('hello')) {
          response = hasItems 
            ? `Hey! 👋 You've got ${itemCount} item(s) ready ($${cartTotal.toFixed(2)}). Want to add more or checkout?`
            : "Hey there! 👋 What sounds good to you today?";
        }
        // Item added
        else if (toolUsage.results?.[0]?.action === 'add' && toolUsage.results[0].productName) {
          const itemName = toolUsage.results[0].productName;
          response = `Added ${itemName}! 🛒 Want drinks or sides with that?`;
        }
        // View cart
        else if (toolUsage.results?.[0]?.action === 'view') {
          if (hasItems) {
            response = `You've got ${itemCount} item(s) totaling $${cartTotal.toFixed(2)}. Ready to checkout or add more?`;
          } else {
            response = "Your cart is empty. Want to see what's on the menu?";
          }
        }
        // Item removed
        else if (toolUsage.results?.[0]?.action === 'remove') {
          response = hasItems 
            ? "Item removed! Want to add something else or continue shopping?"
            : "Cart is now empty. What can I get for you?";
        }
        // Products shown
        else if (toolUsage.results?.[0]?.items?.length > 0) {
          response = "Here's what I found! Which one looks good to you?";
        }
        // Coupon applied
        else if (toolUsage.results?.[0]?.coupon) {
          const savings = toolUsage.results[0].coupon.discountAmount;
          response = `Awesome! You're saving $${savings.toFixed(2)}. Ready to checkout?`;
        }
        // Payment triggered
        else if (toolUsage.results?.[0]?.needsPayment) {
          response = `Perfect! Your total is $${cartTotal.toFixed(2)}. Let's complete your order!`;
        }
        // Generic with cart items
        else if (hasItems) {
          response = `You have ${itemCount} item(s) totaling $${cartTotal.toFixed(2)}. Want to checkout or keep shopping?`;
        }
        // Generic empty cart
        else {
          response = "What can I get for you today?";
        }
      }

      // ✅ Clean up response
      let cleaned = response
        .replace(/^(You are|System|Assistant|Waiter|Response|FoodyBuddy):\s*/gi, '')
        .replace(/^(Customer|User):\s*/gi, '')
        .replace(/^\[.*?\]\s*/g, '')
        .replace(/^(RULES|CURRENT|YOUR RESPONSE):.*/gim, '')
        .trim();

      // Remove leaked instructions
      const lines = cleaned.split('\n').filter(line => {
        const lower = line.toLowerCase();
        return !lower.includes('you are') && 
               !lower.includes('current cart') && 
               !lower.includes('your response') &&
               !lower.includes('rules:') &&
               line.trim().length > 0;
      });
      
      if (lines.length > 0) {
        cleaned = lines.join(' ').trim();
      }

      // Limit to 3 sentences (but handle decimals correctly)
      // Don't break on: $24.97, 3.14, etc.
      const sentenceRegex = /[^.!?]+(?:[.!?](?!\d))+/g;
      const sentences = cleaned.match(sentenceRegex);
      
      if (sentences && sentences.length > 3) {
        // Keep first 3 complete sentences
        cleaned = sentences.slice(0, 3).join(' ').trim();
      }

      // ✅ Ensure follow-up question
      const hasFollowUp = cleaned.includes('?') || 
                         cleaned.match(/\b(want|need|ready|how about|interested|like|try)\b/i);
      
      if (!hasFollowUp) {
        if (toolUsage.results?.[0]?.action === 'add') {
          cleaned += ' Want anything else?';
        } else if (hasItems && itemCount >= 2) {
          cleaned += ' Ready to checkout?';
        } else if (hasItems) {
          cleaned += ' Want to add more?';
        } else {
          cleaned += ' What sounds good?';
        }
      }

      console.log('[LangChain] ✅ Final response:', cleaned);

      await memory.saveContext({ input: message }, { output: cleaned });

      return {
        text: cleaned,
        toolsUsed: toolUsage.tools,
        toolResults: toolUsage.results,
        metadata: {
          model: OLLAMA_MODEL,
          timestamp: new Date().toISOString(),
          hasCart: hasItems,
          cartItemCount: itemCount,
          cartTotal: cartTotal
        }
      };

    } catch (error) {
      console.error('[LangChain] Chat error:', error);
      throw error;
    }
  }

  // ✅ Keep your existing detectToolUsage method (no changes needed)
  async detectToolUsage(customerId, message) {
    const tools = [];
    const results = [];
    const lower = message.toLowerCase();

    try {
      // Clear stale search results (older than 2 minutes)
      if (this.lastSearchTimestamp && this.lastSearchTimestamp.has(customerId)) {
        const now = Date.now();
        if (now - this.lastSearchTimestamp.get(customerId) > 120000) {
          this.lastSearchResults.delete(customerId);
          this.lastSearchTimestamp.delete(customerId);
          console.log('[LangChain] 🧹 Cleared stale search results');
        }
      }

      // PRIORITY 1: "yes" after showing products = ADD TO CART
      if (lower === 'yes' || lower === 'yes please' || lower === 'sure') {
        if (this.lastSearchResults.has(customerId)) {
          const lastSearch = this.lastSearchResults.get(customerId);
          
          if (lastSearch && lastSearch.length > 0) {
            console.log('[LangChain] 💡 "yes" detected after product search - adding to cart');
            console.log('[LangChain] 💡 Adding item:', lastSearch[0].name);
            
            const cartTool = this.tools.find(t => t.name === 'cart_operations');
            if (cartTool) {
              const addResult = await cartTool.func(JSON.stringify({
                action: 'add',
                customerId,
                productId: lastSearch[0].id || lastSearch[0]._id,
                quantity: 1
              }));
              
              tools.push('cart_operations');
              results.push(JSON.parse(addResult));
              
              this.lastSearchResults.delete(customerId);
              this.lastSearchTimestamp.delete(customerId);
              console.log('[LangChain] 🧹 Cleared last search results after adding to cart');
              
              return { tools, results };
            }
          }
        }
      }

      // ✅ PRIORITY 2: CHECKOUT (Must come before product search!)
      const checkoutPatterns = [
        'checkout', 'proceed to checkout', 'proceed to pay', 'ready to pay',
        'place order', 'confirm order', 'complete payment', 'pay now', 'want to checkout'
      ];

      const hasCheckoutKeyword = checkoutPatterns.some(pattern => lower.includes(pattern));
      const isYesForCheckout = (lower === 'yes' || lower === 'confirm') && 
                               !this.lastSearchResults.has(customerId);

      if (hasCheckoutKeyword || isYesForCheckout) {
        console.log('[LangChain] Detected CHECKOUT');
        
        const emailMatch = message.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        let customerEmail = emailMatch ? emailMatch[0] : process.env.DEFAULT_CUSTOMER_EMAIL || 'customer@foodybuddy.com';
        
        const cartTool = this.tools.find(t => t.name === 'cart_operations');
        if (!cartTool) return { tools: [], results: [] };
        
        const cartResult = await cartTool.func(JSON.stringify({ action: 'view', customerId }));
        const cartData = JSON.parse(cartResult);
        
        if (!cartData.cart.items || cartData.cart.items.length === 0) {
          return {
            tools: ['cart_operations'],
            results: [{
              success: false,
              message: 'Your cart is empty! Add items before checkout.'
            }]
          };
        }

        const businessTool = this.tools.find(t => t.name === 'validate_business_rules');
        if (businessTool) {
          const validationResult = await businessTool.func(JSON.stringify({
            orderTotal: cartData.cart.total,
            itemCount: cartData.cart.itemCount,
            deliveryAddress: 'Fort Lauderdale'
          }));
          const validationData = JSON.parse(validationResult);
          
          if (!validationData.passed) {
            tools.push('validate_business_rules');
            results.push({
              success: false,
              validationFailed: true,
              message: validationData.errors.join(' ')
            });
            return { tools, results };
          }
        }

        const appliedCoupon = appliedCoupons.get(customerId);
        
        let discount = 0;
        if (appliedCoupon) {
          if (appliedCoupon.type === 'percentage') {
            discount = (cartData.cart.total * appliedCoupon.discount) / 100;
          } else {
            discount = appliedCoupon.discount;
          }
        }
        
        const subtotal = cartData.cart.total;
        const subtotalAfterDiscount = subtotal - discount;
        const tax = subtotalAfterDiscount * BUSINESS_CONFIG.TAX_RATE;
        const total = subtotalAfterDiscount + tax;
        
        tools.push('checkout');
        results.push({
          success: true,
          needsPayment: true,
          customerEmail: customerEmail,
          payment: {
            type: 'payment',
            email: customerEmail,
            subtotal: parseFloat(subtotal.toFixed(2)),
            tax: parseFloat(tax.toFixed(2)),
            taxRate: BUSINESS_CONFIG.TAX_RATE,
            discount: parseFloat(discount.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
            coupon: appliedCoupon,
            items: cartData.cart.items.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              productId: item.productId
            }))
          },
          showPaymentUI: true
        });
        
        return { tools, results };
      }

      // ✅ PRIORITY 3: COUPON (Must come before product search!)
      if (lower.includes('apply') || lower.includes('use') || lower.includes('coupon') || 
          lower.includes('discount') || lower.includes('promo') || 
          /\b(SAVE10|SAVE20|FLAT5|FIRST)\b/i.test(message)) {
        
        const couponMatch = message.match(/\b(SAVE10|SAVE20|FLAT5|FIRST)\b/i);
        
        if (couponMatch) {
          // User provided coupon code - apply it
          console.log('[LangChain] 💡 Detected coupon code:', couponMatch[1]);
          const couponCode = couponMatch[1];
          const tool = this.tools.find(t => t.name === 'coupon_operations');
          if (tool) {
            const result = await tool.func(JSON.stringify({ 
              action: 'apply', 
              customerId,
              couponCode 
            }));
            tools.push('coupon_operations');
            results.push(JSON.parse(result));
            return { tools, results };
          }
        } else {
          // User asked about coupons but didn't provide code - show available options
          console.log('[LangChain] 💡 Coupon request without code - showing options');
          results.push({
            success: true,
            showCouponOptions: true,
            message: 'Sure! We have SAVE10 (10% off), SAVE20 (20% off), FLAT5 ($5 off), or FIRST (15% off first order). Which one would you like to use?',
            availableCoupons: [
              { code: 'SAVE10', description: '10% off your order' },
              { code: 'SAVE20', description: '20% off your order' },
              { code: 'FLAT5', description: '$5 off your order' },
              { code: 'FIRST', description: '15% off first order' }
            ]
          });
          return { tools: ['coupon_info'], results };
        }
      }

      // ✅ PRIORITY 4: Product search queries (Now comes AFTER checkout/coupon)
      if (lower.includes('want') || lower.includes('need') || lower.includes('looking for') || 
          lower.includes('show me') || lower.includes('get me') || lower.includes('hungry') ||
          lower.includes('sweet') || lower.includes('spicy')) {
        
        // ✅ Exclude if it's actually checkout
        if (lower.includes('checkout') || lower.includes('pay')) {
          // Skip product search, let it fall through
          return { tools, results };
        }
        
        console.log('[LangChain] ✅ Detected PRODUCT SEARCH');
        
        const tool = this.tools.find(t => t.name === 'menu_search');
        if (tool) {
          let searchQuery = message;
          
          if (lower.includes('veg') && !lower.includes('non-veg') && !lower.includes('nonveg')) {
            console.log('[LangChain] Vegetarian search detected');
            searchQuery = 'soup rice vegetables salad pasta noodles';
          }
          else if (lower.includes('non-veg') || lower.includes('nonveg') || lower.includes('non veg')) {
            console.log('[LangChain] Non-vegetarian search detected');
            searchQuery = 'chicken meat fish fry biryani';
          }
          
          const result = await tool.func(searchQuery);
          const searchData = JSON.parse(result);
          
          if (searchData.items && searchData.items.length > 0) {
            let filteredItems = searchData.items;
            
            if (lower.includes('veg') && !lower.includes('non-veg') && !lower.includes('nonveg')) {
              filteredItems = searchData.items.filter(item => {
                const itemName = item.name.toLowerCase();
                const hasNonVeg = itemName.includes('chicken') || itemName.includes('meat') || 
                                 itemName.includes('fish') || itemName.includes('beef') ||
                                 itemName.includes('pork') || itemName.includes('halal') ||
                                 itemName.includes('lamb');
                return !hasNonVeg;
              });
            }
            else if (lower.includes('non-veg') || lower.includes('nonveg') || lower.includes('non veg')) {
              filteredItems = searchData.items.filter(item => {
                const itemName = item.name.toLowerCase();
                const hasNonVeg = itemName.includes('chicken') || itemName.includes('meat') || 
                                 itemName.includes('fish') || itemName.includes('beef') ||
                                 itemName.includes('pork') || itemName.includes('halal') ||
                                 itemName.includes('lamb');
                return hasNonVeg;
              });
            }
            
            searchData.items = filteredItems;
            searchData.itemCount = filteredItems.length;
            
            this.lastSearchResults.set(customerId, filteredItems);
            this.lastSearchTimestamp.set(customerId, Date.now());
            console.log('[LangChain] 💾 Stored', filteredItems.length, 'items for later reference');
          }
          
          tools.push('menu_search');
          results.push(searchData);
          return { tools, results };
        }
      }

      // REMOVE FROM CART
      if (lower.includes('remove') && (lower.includes('from cart') || lower.includes('cart'))) {
        console.log('[LangChain] Detected REMOVE command');
        
        let itemName = message
          .replace(/remove/gi, '')
          .replace(/from cart/gi, '')
          .replace(/cart/gi, '')
          .replace(/all/gi, '')
          .replace(/one/gi, '')
          .trim();
        
        let quantityToRemove = 'all';
        const qtyMatch = message.match(/\b(one|1|two|2|three|3|four|4|five|5)\b/i);
        if (qtyMatch) {
          const qtyMap = { 'one': 1, '1': 1, 'two': 2, '2': 2, 'three': 3, '3': 3, 'four': 4, '4': 4, 'five': 5, '5': 5 };
          quantityToRemove = qtyMap[qtyMatch[1].toLowerCase()] || 'all';
          itemName = itemName.replace(/\b(one|1|two|2|three|3|four|4|five|5)\b/gi, '').trim();
        }

        const cartTool = this.tools.find(t => t.name === 'cart_operations');
        if (cartTool) {
          try {
            const cartResult = await cartTool.func(JSON.stringify({ action: 'view', customerId }));
            const cartData = JSON.parse(cartResult);
            
            if (cartData.cart?.items?.length > 0) {
              const searchLower = itemName.toLowerCase();
              const matchedItem = cartData.cart.items.find(item => 
                item.name.toLowerCase().includes(searchLower) || 
                searchLower.includes(item.name.toLowerCase())
              );
              
              if (matchedItem) {
                const removeResult = await cartTool.func(JSON.stringify({
                  action: 'remove',
                  customerId,
                  productId: matchedItem.productId,
                  quantity: quantityToRemove
                }));
                
                tools.push('cart_operations');
                results.push(JSON.parse(removeResult));
                return { tools, results };
              }
            }
          } catch (e) {}
        }
      }

      // ADD TO CART
      if (lower.includes('add to cart') || (lower.includes('add') && lower.includes('cart')) ||
          lower.startsWith('add ') || lower.includes('i want') || lower.includes('get me')) {
        
        console.log('[LangChain] Detected ADD to cart');
        
        let productName = message
          .replace(/add to cart/gi, '')
          .replace(/to cart/gi, '')
          .replace(/add/gi, '')
          .replace(/i want/gi, '')
          .replace(/get me/gi, '')
          .trim();
        
        const searchTool = this.tools.find(t => t.name === 'menu_search');
        if (searchTool) {
          const searchResult = await searchTool.func(productName);
          const searchData = JSON.parse(searchResult);
          
          if (searchData.items && searchData.items.length > 0) {
            let bestMatch = searchData.items[0];
            
            const normalizedQuery = productName.toLowerCase().trim();
            
            for (const item of searchData.items) {
              const normalizedItemName = item.name.toLowerCase().trim();
              
              if (normalizedItemName === normalizedQuery) {
                bestMatch = item;
                break;
              }
              
              if (normalizedItemName.includes(normalizedQuery)) {
                bestMatch = item;
                break;
              }
            }
            
            const cartTool = this.tools.find(t => t.name === 'cart_operations');
            if (cartTool) {
              const addResult = await cartTool.func(JSON.stringify({
                action: 'add',
                customerId,
                productId: bestMatch.id || bestMatch._id,
                quantity: 1
              }));
              
              tools.push('cart_operations');
              results.push(JSON.parse(addResult));
              return { tools, results };
            }
          }
        }
      }

      // VIEW CART
      if (lower === 'cart' || lower === 'show cart' || lower === 'view cart') {
        const tool = this.tools.find(t => t.name === 'cart_operations');
        if (tool) {
          const result = await tool.func(JSON.stringify({ action: 'view', customerId }));
          tools.push('cart_operations');
          results.push(JSON.parse(result));
          return { tools, results };
        }
      }

      // TRACK SPECIFIC ORDER
      if ((lower.includes('status') || lower.includes('track')) && /\d{4,}/.test(message)) {
        const orderMatch = message.match(/\d{4,}/);
        if (orderMatch) {
          const tool = this.tools.find(t => t.name === 'order_operations');
          if (tool) {
            const result = await tool.func(JSON.stringify({ 
              action: 'track', 
              customerId,
              orderNumber: orderMatch[0]
            }));
            tools.push('order_operations');
            results.push(JSON.parse(result));
            return { tools, results };
          }
        }
      }

      // TRACK ORDERS
      if (lower.includes('orders') || lower.includes('order history')) {
        const tool = this.tools.find(t => t.name === 'order_operations');
        if (tool) {
          const result = await tool.func(JSON.stringify({ action: 'list', customerId }));
          tools.push('order_operations');
          results.push(JSON.parse(result));
          return { tools, results };
        }
      }

    } catch (error) {
      console.error('[LangChain] Tool detection error:', error);
    }

    return { tools, results };
  }

  getAppliedCoupon(customerId) {
    return appliedCoupons.get(customerId) || null;
  }

  clearCoupon(customerId) {
    appliedCoupons.delete(customerId);
  }

  clearSession(customerId) {
    this.sessions.delete(customerId);
    appliedCoupons.delete(customerId);
    this.lastSearchResults.delete(customerId);
    this.lastSearchTimestamp.delete(customerId);
    this.conversationContext.delete(customerId);
  }

  getSessionCount() {
    return this.sessions.size;
  }

  setCurrentCustomer(customerId) {
    this.agentService.currentCustomerId = customerId;
  }
}

module.exports = LangChainAgent;