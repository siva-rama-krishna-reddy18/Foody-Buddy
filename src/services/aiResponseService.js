// src/services/aiResponseService.js
const axios = require('axios');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi';

const SYSTEM_PROMPT = `You are FoodyBuddy, a friendly and helpful AI food ordering assistant. Your role is to help customers discover, order, and track their food orders.

**Your Personality:**
- Warm, friendly, and enthusiastic about food
- Helpful and efficient
- Use emojis naturally but not excessively (1-2 per message)
- Always encourage customers to explore the menu or complete their order

**Your Capabilities:**
- Help customers browse the menu and find food items
- Add items to their cart
- Show cart contents and total
- Apply discount coupons
- Process orders and payments
- Track order status
- Handle reorders

**Guidelines:**
- When greeting, be welcoming and ask how you can help
- When items are added to cart, confirm enthusiastically with item name and price
- When showing cart, summarize items and suggest next steps
- For empty carts, encourage browsing the menu
- When orders are placed, celebrate with order number
- For order tracking, provide clear status updates
- Always be helpful even when things go wrong

**IMPORTANT:**
- Keep responses under 20 words
- Be natural and conversational
- Don't make up information - only use the context provided
- Match the customer's tone`;

async function generateAIResponse(intent, context, userMessage) {
  try {
    const USE_AI = process.env.USE_AI_RESPONSES === 'true';
    
    if (!USE_AI) {
      console.log('[AI] AI responses disabled');
      return getFallbackResponse(intent, context);
    }

    // Build context for the AI
    const contextMessage = buildContextMessage(intent, context, userMessage);
    const fullPrompt = `${SYSTEM_PROMPT}\n\n${contextMessage}\n\nRespond naturally and concisely:`;

    console.log('[AI] Generating response with Ollama...');
    const startTime = Date.now();

    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: fullPrompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        num_predict: 100 // Limit response length
      }
    }, {
      timeout: 10000 // 10 second timeout
    });

    const aiResponse = response.data.response.trim();
    const duration = Date.now() - startTime;
    
    console.log(`[AI] Generated response in ${duration}ms:`, aiResponse.substring(0, 100) + '...');
    
    return aiResponse;

  } catch (error) {
    console.error('[AI] Ollama error:', error.message);
    
    // Check if Ollama is running
    if (error.code === 'ECONNREFUSED') {
      console.error('[AI] ❌ Ollama is not running! Start it with: ollama serve');
    }
    
    return getFallbackResponse(intent, context);
  }
}

function buildContextMessage(intent, context, userMessage) {
  let message = `User said: "${userMessage}"\n\nIntent: ${intent}\n\n`;

  switch (intent) {
    case 'GREETING':
      message += 'The user is greeting you. Welcome them warmly to FoodyBuddy and ask how you can help with their food order.';
      break;

    case 'ADD_TO_CART':
      if (context.product) {
        message += `SUCCESS: You just added "${context.product.name}" ($${context.product.price}) to their cart.\n`;
        message += `Their cart now has ${context.cart.itemCount} item(s) totaling $${context.cart.total}.\n`;
        message += 'Confirm the addition enthusiastically and ask if they want to add more or checkout.';
      } else {
        message += 'FAILED: The item they requested was not found in the menu.\n';
        message += 'Politely let them know and suggest browsing the menu or searching for something else.';
      }
      break;

    case 'VIEW_CART':
      if (context.cart && context.cart.items && context.cart.items.length > 0) {
        message += `Their cart contains:\n`;
        context.cart.items.forEach((item, i) => {
          message += `${i + 1}. ${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}\n`;
        });
        message += `\nTotal: $${context.cart.total}\n`;
        message += 'Summarize their cart briefly and ask if they want to checkout or add more items.';
      } else {
        message += 'Their cart is empty.\n';
        message += 'Encourage them to browse the menu and find something delicious.';
      }
      break;

    case 'CHECKOUT':
      message += `Processing checkout.\n`;
      message += `Total amount: $${context.total}\n`;
      if (context.discount && context.discount > 0) {
        message += `Discount applied: -$${context.discount} with coupon ${context.couponCode}\n`;
        message += `Final amount: $${context.total}\n`;
      }
      message += 'Confirm the total and let them know they can proceed to payment.';
      break;

    case 'PAYMENT_SUCCESS':
      message += `SUCCESS! Order placed.\n`;
      message += `Order number: ${context.orderNumber}\n`;
      message += `Total paid: $${context.total}\n`;
      if (context.discount && context.discount > 0) {
        message += `They saved: $${context.discount} with coupon ${context.couponCode}\n`;
      }
      message += 'Celebrate their order and let them know their food will be prepared soon.';
      break;

    case 'ORDER_STATUS':
      message += `They have ${context.orderCount} order(s) in their history.\n`;
      message += 'Let them know they can view their orders below and track their status.';
      break;

    case 'TRACK_ORDER':
      if (context.order) {
        message += `Order #${context.order.orderNumber}\n`;
        message += `Status: ${context.order.status}\n`;
        message += `Total: $${context.order.total}\n`;
        message += `Items: ${context.order.items.length}\n`;
        if (context.order.estimatedDelivery) {
          message += `Estimated delivery: ${context.order.estimatedDelivery}\n`;
        }
        message += 'Provide a friendly status update for their order.';
      } else {
        message += 'Order not found.\n';
        message += 'Ask them to check the order number or view all orders.';
      }
      break;

    case 'RECOMMEND':
      message += `Showing ${context.productCount || 'menu'} items from our menu.\n`;
      message += 'Let them know they can add items to cart.';
      break;

    case 'SEARCH':
      if (context.productCount > 0) {
        message += `Found ${context.productCount} items matching their search.\n`;
        message += 'Encourage them to add items to cart.';
      } else {
        message += 'No items found matching their search.\n';
        message += 'Suggest trying different keywords or browsing the full menu.';
      }
      break;

    case 'REMOVE_FROM_CART':
      message += `Removed item from cart.\n`;
      message += 'Confirm the removal briefly.';
      break;

    case 'CLEAR_CART':
      message += `Cleared all items from cart.\n`;
      message += 'Confirm and suggest viewing the menu.';
      break;

    case 'REORDER':
      if (context.success) {
        message += `Items from order #${context.orderNumber} have been added back to their cart.\n`;
        message += 'Confirm the reorder and ask if they want to checkout or modify.';
      } else {
        message += 'Could not reorder.\n';
        message += 'Apologize and suggest placing a new order.';
      }
      break;

    case 'UNKNOWN':
      message += 'You did not understand their request.\n';
      message += 'Politely ask them to rephrase or suggest: viewing menu, tracking orders, or adding items to cart.';
      break;

    default:
      message += 'Respond helpfully based on the context provided.';
  }

  return message;
}

function getFallbackResponse(intent, context) {
  const fallbacks = {
    GREETING: "Hello! 👋 Welcome to FoodyBuddy. I'm here to help you order delicious food. What would you like today?",
    ADD_TO_CART: context.product 
      ? `Great choice! Added ${context.product.name} ($${context.product.price}) to your cart! 🛒`
      : "I couldn't find that item. Try browsing our menu! 🔍",
    VIEW_CART: context.cart && context.cart.items?.length > 0
      ? `Your cart: ${context.cart.itemCount} item(s), $${context.cart.total}. Ready to checkout?`
      : "Your cart is empty! Browse our menu to add items. 🛒",
    CHECKOUT: `Ready to checkout! Total: $${context.total}. 💳`,
    PAYMENT_SUCCESS: `🎉 Order #${context.orderNumber} placed! Total: $${context.total}`,
    ORDER_STATUS: `You have ${context.orderCount} order(s). 📦`,
    TRACK_ORDER: context.order 
      ? `Order #${context.order.orderNumber} - ${context.order.status}`
      : "Order not found. Check the order number.",
    RECOMMEND: "Here's our menu! Add items to your cart. 🍽️",
    SEARCH: context.productCount > 0
      ? `Found ${context.productCount} items! 🔍`
      : "No items found. Try different keywords.",
    REMOVE_FROM_CART: "Item removed from cart.",
    CLEAR_CART: "Cart cleared! 🗑️",
    REORDER: context.success ? `Items from order #${context.orderNumber} added to cart!` : "Could not reorder.",
    UNKNOWN: "I didn't understand. Try: 'Show menu' or 'Track orders'"
  };

  return fallbacks[intent] || "How can I help you today?";
}

// Test Ollama connection
async function testOllamaConnection() {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 3000 });
    console.log('[AI] ✅ Ollama connected. Available models:', response.data.models.map(m => m.name).join(', '));
    return true;
  } catch (error) {
    console.error('[AI] ❌ Ollama not available:', error.message);
    console.error('[AI] Make sure Ollama is running: ollama serve');
    return false;
  }
}

module.exports = {
  generateAIResponse,
  getFallbackResponse,
  testOllamaConnection
};