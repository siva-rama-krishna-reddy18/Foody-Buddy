// src/services/langchainService.js
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
  TAX_RATE: 0.08, // 8% tax
  MIN_ORDER_AMOUNT: 5.00,
  DELIVERY_ZONES: ['Fort Lauderdale', 'Miami', 'Boca Raton', 'Hollywood', 'Pompano Beach'],
  ESTIMATED_DELIVERY_TIME: 35, // minutes
};

//  Store applied coupons per customer
const appliedCoupons = new Map();

//  ADD: Clear all coupons when server starts
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
            
            //  Get updated cart
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

        //  Helper function to map status
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
            
            // Available coupons
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
            
            //  Store coupon for this customer
            appliedCoupons.set(customerId, coupon);
            console.log('[CouponTool] ✅ Stored coupon for customer:', customerId);
            
            const cart = await agentService.getCart(customerId);
            
            // Calculate discount
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
            console.log('[CouponTool]  Removed coupon for customer:', customerId);
            
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
// TOOL 5: Email Tool (NEW)
// ============================================================================
function createEmailTool() {
  return new DynamicTool({
    name: "send_email",
    description: "Send order confirmation emails to customers after successful orders. Use this after payment is confirmed.",
    func: async (input) => {
      try {
        const { recipient, subject, orderDetails } = JSON.parse(input);
        
        if (!recipient) throw new Error('recipient email required');
        if (!orderDetails) throw new Error('orderDetails required');
        
        console.log('[EmailTool] Sending email to:', recipient);
        
        // Configure email transporter
        const transporter = nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
        
        // Email template
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
                
                <p style="margin-top: 20px; color: #666;">
                  We'll send you another email when your order is ready for pickup or out for delivery.
                </p>
              </div>
              <div class="footer">
                <p>FoodyBuddy - Your Personal Food Ordering Assistant</p>
                <p>Questions? Reply to this email or visit www.foodybuddy.app</p>
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
        
        console.log('[EmailTool]  Email sent successfully:', result.messageId);
        
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

// ============================================================================
// TOOL 6: Payment Tool (DEMO MODE - No Stripe Required)
// ============================================================================
function createPaymentTool() {
  return new DynamicTool({
    name: "process_payment",
    description: "Process customer payments (demo mode). Use this when customer is ready to pay.",
    func: async (input) => {
      try {
        const { amount, customerEmail, orderData } = JSON.parse(input);
        
        if (!amount || amount <= 0) throw new Error('Valid amount required');
        
        console.log('[PaymentTool]  Processing DEMO payment:', {
          amount: `$${amount.toFixed(2)}`,
          customerEmail: customerEmail || 'N/A',
          orderNumber: orderData?.orderNumber || 'N/A',
          items: orderData?.items?.length || 0
        });
        
        //  Simulate payment processing delay (realistic UX)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        //  Generate realistic mock payment data
        const mockPaymentIntentId = `pi_demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const mockClientSecret = `${mockPaymentIntentId}_secret_${Math.random().toString(36).substr(2, 16)}`;
        const mockReceiptUrl = `https://demo.foodybuddy.app/receipt/${mockPaymentIntentId}`;
        
        //  Simulate random payment methods for realism
        const paymentMethods = [
          { method: 'card', brand: 'Visa', last4: '4242' },
          { method: 'card', brand: 'Mastercard', last4: '5555' },
          { method: 'card', brand: 'Amex', last4: '3782' }
        ];
        const selectedMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
        
        console.log('[PaymentTool]  DEMO Payment processed successfully:', mockPaymentIntentId);
        
        return JSON.stringify({
          success: true,
          demo: true,
          paymentIntentId: mockPaymentIntentId,
          clientSecret: mockClientSecret,
          amount: parseFloat(amount.toFixed(2)),
          status: 'succeeded',
          currency: 'usd',
          paymentMethod: selectedMethod.method,
          last4: selectedMethod.last4,
          brand: selectedMethod.brand,
          receiptUrl: mockReceiptUrl,
          message: ` Payment successful! Paid $${amount.toFixed(2)} with ${selectedMethod.brand} ending in ${selectedMethod.last4}`,
          receipt: {
            orderNumber: orderData?.orderNumber || 'N/A',
            amount: parseFloat(amount.toFixed(2)),
            paymentDate: new Date().toISOString(),
            paymentId: mockPaymentIntentId,
            status: 'paid',
            customerEmail: customerEmail || 'N/A'
          },
          metadata: {
            orderNumber: orderData?.orderNumber,
            itemCount: orderData?.items?.length || 0,
            processingTime: '1.5s'
          }
        });
        
      } catch (error) {
        console.error('[PaymentTool]  Error:', error);
        return JSON.stringify({ 
          success: false,
          demo: true,
          error: error.message,
          message: ' Payment processing failed (Demo Mode). Please try again.' 
        });
      }
    }
  });
}

// ============================================================================
// TOOL 7: Inventory Tool (NEW)
// ============================================================================
function createInventoryTool() {
  return new DynamicTool({
    name: "check_inventory",
    description: "Check product availability and stock levels before adding to cart. Use this to verify items are in stock.",
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
        
        console.log('[InventoryTool] Stock check:', {
          product: product.name,
          available: isAvailable,
          stock: product.stock
        });
        
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

// ============================================================================
// TOOL 8: Business Rules Validation Tool (NEW)
// ============================================================================
function createBusinessRulesTool() {
  return new DynamicTool({
    name: "validate_business_rules",
    description: "Validate minimum order amount and delivery zones before checkout. Use this before processing payment.",
    func: async (input) => {
      try {
        const { orderTotal, deliveryAddress, itemCount } = JSON.parse(input);
        
        const validationResults = {
          passed: true,
          errors: [],
          warnings: []
        };
        
        // Check minimum order amount
        if (orderTotal < BUSINESS_CONFIG.MIN_ORDER_AMOUNT) {
          validationResults.passed = false;
          validationResults.errors.push(
            `Minimum order amount is $${BUSINESS_CONFIG.MIN_ORDER_AMOUNT.toFixed(2)}. Your cart is $${orderTotal.toFixed(2)}.`
          );
        }
        
        // Check if cart is empty
        if (!itemCount || itemCount === 0) {
          validationResults.passed = false;
          validationResults.errors.push('Your cart is empty. Please add items before checkout.');
        }
        
        // Check delivery zone (if address provided)
        if (deliveryAddress) {
          const addressLower = deliveryAddress.toLowerCase();
          const isInZone = BUSINESS_CONFIG.DELIVERY_ZONES.some(zone => 
            addressLower.includes(zone.toLowerCase())
          );
          
          if (!isInZone) {
            validationResults.passed = false;
            validationResults.errors.push(
              `Sorry, we don't deliver to your area yet. We currently deliver to: ${BUSINESS_CONFIG.DELIVERY_ZONES.join(', ')}`
            );
          }
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
// MAIN LANGCHAIN AGENT CLASS
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
  }

  async initialize() {
    if (this.initialized) return;
    
    console.log('[LangChain] Initializing...');
    console.log('[LangChain] Ollama URL:', OLLAMA_BASE_URL);
    console.log('[LangChain] Model:', OLLAMA_MODEL);

    try {
      this.llm = new Ollama({
        baseUrl: OLLAMA_BASE_URL,
        model: OLLAMA_MODEL,
        temperature: 0.3,
        numPredict: 50,
      });

      await this.llm.call("test");
      console.log('[LangChain]  Ollama connected');

      //  Initialize all 8 tools
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
      console.log('[LangChain]  Initialized with', this.tools.length, 'tools');
      console.log('[LangChain] Available tools:', this.tools.map(t => t.name).join(', '));
    } catch (error) {
      console.error('[LangChain]  Init failed:', error.message);
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

 async chat(customerId, message) {
  try {
    if (!this.initialized) await this.initialize();

    const memory = this.getOrCreateMemory(customerId);
    const history = await memory.loadMemoryVariables({});
    const chatHistory = history.chat_history || [];

    //  Better prompt for Mistral
    const systemPrompt = `You are a helpful restaurant assistant. Keep responses brief and friendly (under 20 words).

${chatHistory.slice(-1).map(m => m.content).join('\n')}

Customer: ${message}
Reply:`;

    const response = await this.llm.call(systemPrompt);
    
    
    let cleanedResponse = response
      .replace(/^(User:|Human:|Assistant:|Customer:|Reply:)\s*/gi, '')
      .replace(/\n(User:|Human:|Assistant:|Customer:|Reply:)\s*/gi, '\n')
      .trim();

    await memory.saveContext({ input: message }, { output: cleanedResponse });

    const toolUsage = await this.detectToolUsage(customerId, message);

    return {
      text: cleanedResponse,  // ✅ Use cleaned response
      toolsUsed: toolUsage.tools,
      toolResults: toolUsage.results,
      metadata: {
        model: OLLAMA_MODEL,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('[LangChain] Chat error:', error);
    throw error;
  }
}

  async detectToolUsage(customerId, message) {
    const tools = [];
    const results = [];
    const lower = message.toLowerCase();

    try {
      // ✅ PRIORITY 1: Product search queries (want/need/looking for)
if (lower.includes('want') || lower.includes('need') || lower.includes('looking for') || 
    lower.includes('show me') || lower.includes('get me')) {
  console.log('[LangChain] ✅ Detected PRODUCT SEARCH');
  
  const tool = this.tools.find(t => t.name === 'menu_search');
  if (tool) {
    // ✅ Improve search query based on veg/non-veg
    let searchQuery = message;
    
    // For veg requests, search for vegetarian items
    if (lower.includes('veg') && !lower.includes('non-veg') && !lower.includes('nonveg')) {
      console.log('[LangChain]  Vegetarian search detected');
      searchQuery = 'soup rice vegetables salad pasta noodles'; // Veg items
    }
    // For non-veg requests, search for non-vegetarian items
    else if (lower.includes('non-veg') || lower.includes('nonveg') || lower.includes('non veg')) {
      console.log('[LangChain]  Non-vegetarian search detected');
      searchQuery = 'chicken meat fish fry biryani'; // Non-veg items
    }
    
    const result = await tool.func(searchQuery);
    const searchData = JSON.parse(result);
    
    
    if (searchData.items && searchData.items.length > 0) {
      let filteredItems = searchData.items;
      
      // Filter for vegetarian (exclude items with meat keywords)
      if (lower.includes('veg') && !lower.includes('non-veg') && !lower.includes('nonveg')) {
        console.log('[LangChain]  Filtering for vegetarian items');
        filteredItems = searchData.items.filter(item => {
          const itemName = item.name.toLowerCase();
          const hasNonVeg = itemName.includes('chicken') || 
                           itemName.includes('meat') || 
                           itemName.includes('fish') ||
                           itemName.includes('beef') ||
                           itemName.includes('pork') ||
                           itemName.includes('halal') ||
                           itemName.includes('lamb');
          return !hasNonVeg; // Return items WITHOUT meat keywords
        });
        
        console.log('[LangChain]  Filtered vegetarian items:', filteredItems.length);
      }
      
      // Filter for non-vegetarian (include ONLY items with meat keywords)
      else if (lower.includes('non-veg') || lower.includes('nonveg') || lower.includes('non veg')) {
        console.log('[LangChain]  Filtering for non-vegetarian items');
        filteredItems = searchData.items.filter(item => {
          const itemName = item.name.toLowerCase();
          const hasNonVeg = itemName.includes('chicken') || 
                           itemName.includes('meat') || 
                           itemName.includes('fish') ||
                           itemName.includes('beef') ||
                           itemName.includes('pork') ||
                           itemName.includes('halal') ||
                           itemName.includes('lamb');
          return hasNonVeg; // Return ONLY items WITH meat keywords
        });
        
        console.log('[LangChain]  Filtered non-vegetarian items:', filteredItems.length);
      }
      
      //  Update search results with filtered items
      searchData.items = filteredItems;
      searchData.itemCount = filteredItems.length;
    }
    
    tools.push('menu_search');
    results.push(searchData);
    return { tools, results };
  }
}

     //  REMOVE FROM CART
if (lower.includes('remove') && (lower.includes('from cart') || lower.includes('cart'))) {
  console.log('[LangChain]  Detected REMOVE command');
  
  // Extract item name
  let itemName = message
    .replace(/remove/gi, '')
    .replace(/from cart/gi, '')
    .replace(/cart/gi, '')
    .trim();
  
  console.log('[LangChain] Item to remove:', itemName);
  
  // Extract quantity if specified
  let quantityToRemove = null;
  const quantityMatch = itemName.match(/^(one|two|three|four|five|1|2|3|4|5)\s+/i);
  
  if (quantityMatch) {
    const quantityWord = quantityMatch[1].toLowerCase();
    const quantityMap = {
      'one': 1, '1': 1,
      'two': 2, '2': 2,
      'three': 3, '3': 3,
      'four': 4, '4': 4,
      'five': 5, '5': 5
    };
    
    quantityToRemove = quantityMap[quantityWord] || 1;
    itemName = itemName.replace(quantityMatch[0], '').trim();
    
    console.log('[LangChain]  Quantity to remove:', quantityToRemove);
    console.log('[LangChain]  Item name after extraction:', itemName);
  }
  
  // Search for product
  const searchTool = this.tools.find(t => t.name === 'menu_search');
  if (searchTool) {
    const searchResult = await searchTool.func(itemName);
    const searchData = JSON.parse(searchResult);
    
    if (searchData.items && searchData.items.length > 0) {
      //  IMPROVED: Better best match logic
      let bestMatch = null;
      const normalizedQuery = itemName.toLowerCase().trim();
      
      console.log('[LangChain]  Searching for best match among', searchData.items.length, 'results');
      
      // PRIORITY 1: Perfect exact match
      for (const item of searchData.items) {
        const normalizedItemName = item.name.toLowerCase().trim();
        if (normalizedItemName === normalizedQuery) {
          bestMatch = item;
          console.log('[LangChain]  Found PERFECT EXACT match:', item.name);
          break;
        }
      }
      
      // PRIORITY 2: Query is contained in item name (e.g., "chicken biryani" in "Chicken Biryani")
      if (!bestMatch) {
        for (const item of searchData.items) {
          const normalizedItemName = item.name.toLowerCase().trim();
          if (normalizedItemName.includes(normalizedQuery)) {
            bestMatch = item;
            console.log('[LangChain]  Found CONTAINS match:', item.name);
            break;
          }
        }
      }
      
      // PRIORITY 3: All words from query appear in item name
      if (!bestMatch) {
        const queryWords = normalizedQuery.split(/\s+/);
        for (const item of searchData.items) {
          const normalizedItemName = item.name.toLowerCase().trim();
          const allWordsMatch = queryWords.every(word => normalizedItemName.includes(word));
          if (allWordsMatch && queryWords.length > 1) {
            bestMatch = item;
            console.log('[LangChain]  Found ALL WORDS match:', item.name);
            break;
          }
        }
      }
      
      // FALLBACK: Use first result
      if (!bestMatch) {
        bestMatch = searchData.items[0];
        console.log('[LangChain]  Using first result as fallback:', bestMatch.name);
      }
      
      console.log('[LangChain]  Selected best match:', bestMatch.name, '(ID:', bestMatch.id || bestMatch._id, ')');
      
      // Remove from cart
      const cartTool = this.tools.find(t => t.name === 'cart_operations');
      if (cartTool) {
        const removeResult = await cartTool.func(JSON.stringify({
          action: 'remove',
          customerId,
          productId: bestMatch.id || bestMatch._id,
          quantity: quantityToRemove
        }));
        
        tools.push('cart_operations');
        results.push(JSON.parse(removeResult));
        return { tools, results };
      }
    }
  }
}

      //  ADD TO CART
if (lower.includes('add to cart') || lower.includes('add') && lower.includes('cart') ||
    lower.startsWith('add ') || lower.includes('i want') || lower.includes('get me')) {
  
  console.log('[LangChain]  Detected ADD to cart');
  
  // Extract product name
  let productName = message
    .replace(/add to cart/gi, '')
    .replace(/to cart/gi, '')
    .replace(/add/gi, '')
    .replace(/i want/gi, '')
    .replace(/get me/gi, '')
    .trim();
  
  console.log('[LangChain]  Detected ADD to cart:', productName);
  
  // Search for product
  const searchTool = this.tools.find(t => t.name === 'menu_search');
  if (searchTool) {
    const searchResult = await searchTool.func(productName);
    const searchData = JSON.parse(searchResult);
    
    if (searchData.items && searchData.items.length > 0) {
      
      let bestMatch = searchData.items[0];
      
      // Look for exact or near-exact name match
      const normalizedQuery = productName.toLowerCase().trim();
      
      for (const item of searchData.items) {
        const normalizedItemName = item.name.toLowerCase().trim();
        
        // Perfect match
        if (normalizedItemName === normalizedQuery) {
          bestMatch = item;
          console.log('[LangChain]  Found PERFECT match:', item.name);
          break;
        }
        
        // Contains the full query
        if (normalizedItemName.includes(normalizedQuery)) {
          bestMatch = item;
          console.log('[LangChain]  Found CONTAINS match:', item.name);
          break;
        }
        
        // Query contains the item name (for shorter names)
        if (normalizedQuery.includes(normalizedItemName)) {
          bestMatch = item;
          console.log('[LangChain]  Found INCLUDED match:', item.name);
        }
      }
      
      console.log('[LangChain]  Selected best match:', bestMatch.name);
      
      // Add to cart
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
    } else {
      // No products found
      tools.push('menu_search');
      results.push({
        success: false,
        message: `Sorry, I couldn't find "${productName}" in our menu. Would you like to see what's available?`
      });
      return { tools, results };
    }
  }
}
      //  VIEW CART
      if (lower === 'cart' || lower === 'show cart' || lower === 'view cart' || 
          lower === 'show my cart' || lower === 'my cart') {
        console.log('[LangChain]  Detected VIEW CART');
        const tool = this.tools.find(t => t.name === 'cart_operations');
        if (tool) {
          const result = await tool.func(JSON.stringify({ action: 'view', customerId }));
          tools.push('cart_operations');
          results.push(JSON.parse(result));
          return { tools, results };
        }
      }

      //  APPLY COUPON
      if (lower.includes('apply coupon') || lower.includes('use coupon')) {
        const couponMatch = message.match(/(?:apply|use)\s+coupon\s+([A-Z0-9]+)/i);
        if (couponMatch) {
          const couponCode = couponMatch[1];
          console.log('[LangChain]  Detected APPLY COUPON:', couponCode);
          
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
        }
      }

      //  REMOVE COUPON
      if (lower.includes('remove coupon') || lower.includes('delete coupon')) {
        console.log('[LangChain]  Detected REMOVE COUPON');
        const tool = this.tools.find(t => t.name === 'coupon_operations');
        if (tool) {
          const result = await tool.func(JSON.stringify({ 
            action: 'remove', 
            customerId 
          }));
          tools.push('coupon_operations');
          results.push(JSON.parse(result));
          return { tools, results };
        }
      }

      
// SPECIAL INSTRUCTIONS
if ((lower.includes('make it') || lower.includes('please') || lower.includes('can you') ||
     lower.includes('instruction') || lower.includes('note') || lower.includes('request')) &&
    !lower.includes('order') && !lower.includes('checkout') && !lower.includes('confirm')) {
  
  console.log('[LangChain] 📝 Detected SPECIAL INSTRUCTION request');
  
  // Extract the instruction
  let instruction = message;
  if (lower.startsWith('make it ')) {
    instruction = message.substring('make it '.length);
  } else if (lower.startsWith('please ')) {
    instruction = message.substring('please '.length);
  }
  
  // Get current cart to apply instruction to all items
  const cartTool = this.tools.find(t => t.name === 'cart_operations');
  if (cartTool) {
    const cartResult = await cartTool.func(JSON.stringify({ action: 'view', customerId }));
    const cartData = JSON.parse(cartResult);
    
    if (cartData.cart.items && cartData.cart.items.length > 0) {
      // Store special instructions in memory for this customer
      const specialInstructions = {};
      cartData.cart.items.forEach(item => {
        specialInstructions[item.productId] = instruction;
      });
      
      
      if (!this.specialInstructionsStore) {
        this.specialInstructionsStore = new Map();
      }
      this.specialInstructionsStore.set(customerId, specialInstructions);
      
      console.log('[LangChain] 📝 Stored special instructions:', specialInstructions);
      
      tools.push('special_instructions');
      results.push({
        success: true,
        message: ` Special instruction noted: "${instruction}"`,
        specialInstructions: specialInstructions
      });
      return { tools, results };
    }
  }
}

// ✅ CHECKOUT / PAYMENT - More forgiving matching
const checkoutPatterns = [
  'checkout',
  'proceed to pay',
  'ready to pay',
  'place order',
  'confirm order',
  'confirm my order',
  'confirm',
  'confirm my orer',  
  'confrim',          
  'yes'
];

const isCheckout = checkoutPatterns.some(pattern => lower.includes(pattern)) || lower === 'yes' || lower === 'confirm';

if (isCheckout) {
  console.log('[LangChain]  Detected CHECKOUT');
  
  //  Extract email from message (optional now)
  const emailMatch = message.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  let customerEmail = emailMatch ? emailMatch[0] : null;
  
  //  CRITICAL: If no email provided, use default email (NO needsEmail error!)
  if (!customerEmail) {
    customerEmail = process.env.DEFAULT_CUSTOMER_EMAIL || process.env.EMAIL_USER || 'customer@foodybuddy.com';
    console.log('[LangChain]  No email provided, using default:', customerEmail);
  }
  
  // Get cart
  const cartTool = this.tools.find(t => t.name === 'cart_operations');
  if (!cartTool) {
    console.error('[LangChain]  Cart tool not found');
    return { tools: [], results: [] };
  }
  
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

  // ✅ Retrieve stored special instructions
  let specialInstructions = {};
  if (this.specialInstructionsStore && this.specialInstructionsStore.has(customerId)) {
    specialInstructions = this.specialInstructionsStore.get(customerId);
    console.log('[LangChain] 📝 Retrieved stored special instructions:', specialInstructions);
  }
  
  // Validate business rules
  const businessTool = this.tools.find(t => t.name === 'validate_business_rules');
  if (businessTool) {
    const validationResult = await businessTool.func(JSON.stringify({
      orderTotal: cartData.cart.total,
      itemCount: cartData.cart.itemCount,
      deliveryAddress: 'Fort Lauderdale'
    }));
    const validationData = JSON.parse(validationResult);
    
   if (!validationData.passed) {
    console.log('[LangChain]  Business validation failed:', validationData.errors);
    
    //  Return helpful error message
    tools.push('validate_business_rules');
    results.push({
      success: false,
      validationFailed: true,
      errors: validationData.errors,
      message: validationData.errors.join(' ') + ' Please add more items to your cart.',
      suggestions: ['View menu', 'Add more items']
    });
    return { tools, results };
  }
}

  //  Get applied coupon from memory
  const appliedCoupon = this.getAppliedCoupon(customerId);
  
  //  Calculate discount
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percentage') {
      discount = (cartData.cart.total * appliedCoupon.discount) / 100;
    } else {
      discount = appliedCoupon.discount;
    }
    console.log('[LangChain]  Applied coupon:', {
      code: appliedCoupon.code,
      discount: appliedCoupon.discount,
      type: appliedCoupon.type,
      discountAmount: discount.toFixed(2)
    });
  }
  
  //  Calculate tax on subtotal AFTER discount
  const subtotal = cartData.cart.total;
  const subtotalAfterDiscount = subtotal - discount;
  const tax = subtotalAfterDiscount * BUSINESS_CONFIG.TAX_RATE;
  const total = subtotalAfterDiscount + tax;
  
  console.log('[LangChain]  Order ready for:', customerEmail);
  console.log('[LangChain]  Breakdown:', {
    subtotal: '$' + subtotal.toFixed(2),
    discount: '$' + discount.toFixed(2),
    subtotalAfterDiscount: '$' + subtotalAfterDiscount.toFixed(2),
    tax: '$' + tax.toFixed(2),
    total: '$' + total.toFixed(2),
    coupon: appliedCoupon?.code || 'None'
  });
  
  //  Return payment UI data
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
      })),
       specialInstructions: specialInstructions
    },
    showPaymentUI: true
  });
  //  Clear special instructions after checkout
  if (this.specialInstructionsStore) {
    this.specialInstructionsStore.delete(customerId);
  }
  
  return { tools, results };
}

      //  PROCESS PAYMENT (after user confirms)
      if (lower.includes('confirm payment') || lower.includes('pay now')) {
        console.log('[LangChain]  Detected PAYMENT CONFIRMATION');
        
        // Get cart and calculate total
        const cartTool = this.tools.find(t => t.name === 'cart_operations');
        const orderTool = this.tools.find(t => t.name === 'order_operations');
        const paymentTool = this.tools.find(t => t.name === 'process_payment');
        const emailTool = this.tools.find(t => t.name === 'send_email');
        
        if (cartTool && orderTool && paymentTool) {
          const cartResult = await cartTool.func(JSON.stringify({ action: 'view', customerId }));
          const cartData = JSON.parse(cartResult);
          
          const calcResult = await orderTool.func(JSON.stringify({
            action: 'calculate_total',
            customerId,
            orderData: {
              items: cartData.cart.items.map(item => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity
              }))
            }
          }));
          const totalData = JSON.parse(calcResult);
          
          // Process payment
          const orderNumber = `ORD${Date.now()}`;
          const paymentResult = await paymentTool.func(JSON.stringify({
            amount: totalData.total,
            customerEmail: 'foodybuddyuser@gmail.com', // Extract from user or use default
            orderData: {
              orderNumber: orderNumber,
              customerId: customerId,
              items: cartData.cart.items
            }
          }));
          const paymentData = JSON.parse(paymentResult);
          
          // Send confirmation email
          if (paymentData.success && emailTool) {
            await emailTool.func(JSON.stringify({
              recipient: 'foodybuddyuser@gmail.com',
              subject: `Order Confirmation #${orderNumber}`,
              orderDetails: {
                orderNumber: orderNumber,
                items: cartData.cart.items.map(item => ({
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price
                })),
                subtotal: totalData.subtotal,
                tax: totalData.tax,
                discount: cartData.cart.discount || 0,
                total: totalData.total
              }
            }));
          }
          
          // Clear cart and coupon
          await cartTool.func(JSON.stringify({ action: 'clear', customerId }));
          
          tools.push('process_payment', 'send_email', 'cart_operations');
          results.push(paymentData);
          return { tools, results };
        }
      }

      //  TRACK SPECIFIC ORDER (View Details)
      if ((lower.includes('details') || lower.includes('show') || lower.includes('track')) && /\d{4,}/.test(message)) {
        console.log('[LangChain]  Detected TRACK SPECIFIC ORDER');
        
        const orderMatch = message.match(/\d{4,}/);
        if (orderMatch) {
          const orderNumber = orderMatch[0];
          console.log('[LangChain] Order number:', orderNumber);
          
          const tool = this.tools.find(t => t.name === 'order_operations');
          if (tool) {
            const result = await tool.func(JSON.stringify({ 
              action: 'track', 
              customerId,
              orderNumber 
            }));
            tools.push('order_operations');
            results.push(JSON.parse(result));
            return { tools, results };
          }
        }
      }

      //  REORDER
      if (lower.includes('reorder') && /\d{4,}/.test(message)) {
        console.log('[LangChain]  Detected REORDER');
        
        const orderMatch = message.match(/\d{4,}/);
        if (orderMatch) {
          const orderNumber = orderMatch[0];
          console.log('[LangChain] Reordering:', orderNumber);
          
          const orderTool = this.tools.find(t => t.name === 'order_operations');
          if (orderTool) {
            const orderResult = await orderTool.func(JSON.stringify({ 
              action: 'track', 
              customerId,
              orderNumber 
            }));
            
            const orderData = JSON.parse(orderResult);
            
            if (orderData.success && orderData.order && orderData.order.items) {
              const cartTool = this.tools.find(t => t.name === 'cart_operations');
              if (cartTool) {
                for (const item of orderData.order.items) {
                  const searchTool = this.tools.find(t => t.name === 'menu_search');
                  if (searchTool) {
                    const searchResult = await searchTool.func(item.name);
                    const searchData = JSON.parse(searchResult);
                    
                    if (searchData.items && searchData.items.length > 0) {
                      const product = searchData.items[0];
                      await cartTool.func(JSON.stringify({
                        action: 'add',
                        customerId,
                        productId: product.id,
                        quantity: item.quantity
                      }));
                    }
                  }
                }
                
                const cartResult = await cartTool.func(JSON.stringify({ 
                  action: 'view', 
                  customerId 
                }));
                tools.push('cart_operations');
                results.push(JSON.parse(cartResult));
                return { tools, results };
              }
            }
          }
        }
      }

      //  TRACK ALL ORDERS
      if (lower.includes('track') || lower.includes('my orders') || lower.includes('orders') || 
          lower.includes('order history')) {
        console.log('[LangChain]  Detected TRACK ORDERS');
        const tool = this.tools.find(t => t.name === 'order_operations');
        if (tool) {
          const result = await tool.func(JSON.stringify({ action: 'list', customerId }));
          tools.push('order_operations');
          results.push(JSON.parse(result));
          return { tools, results };
        }
      }

      //  VIEW MENU / SPECIALS
      if (lower.includes('menu') || lower.includes('special') || lower.includes('recommend')) {
        console.log('[LangChain]  Detected MENU REQUEST');
        const tool = this.tools.find(t => t.name === 'menu_search');
        if (tool) {
          const result = await tool.func(message);
          tools.push('menu_search');
          results.push(JSON.parse(result));
          return { tools, results };
        }
      }

      //  CHECK INVENTORY
      if (lower.includes('available') || lower.includes('in stock') || lower.includes('stock')) {
        console.log('[LangChain]  Detected INVENTORY CHECK');
        
        // Extract product name
        const words = message.split(' ');
        const productName = words.slice(2).join(' '); // Skip "is [product] available"
        
        const tool = this.tools.find(t => t.name === 'check_inventory');
        if (tool && productName) {
          const result = await tool.func(JSON.stringify({ productName }));
          tools.push('check_inventory');
          results.push(JSON.parse(result));
          return { tools, results };
        }
      }

    } catch (error) {
      console.error('[LangChain] Tool detection error:', error);
    }

    return { tools, results };
  }

  // ✅ Get stored coupon for customer
  getAppliedCoupon(customerId) {
    return appliedCoupons.get(customerId) || null;
  }

  // ✅ Clear coupon when order placed
  clearCoupon(customerId) {
    appliedCoupons.delete(customerId);
    console.log('[LangChain] ✅ Cleared coupon for:', customerId);
  }

  clearSession(customerId) {
    this.sessions.delete(customerId);
    appliedCoupons.delete(customerId);
    console.log('[LangChain] Session cleared for:', customerId);
  }

  getSessionCount() {
    return this.sessions.size;
  }

  // ✅ ADD THIS METHOD
setCurrentCustomer(customerId) {
  this.agentService.currentCustomerId = customerId;
  console.log('[LangChain] Set current customer:', customerId);
}
}

module.exports = LangChainAgent;