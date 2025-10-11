// src/services/aiResponseService.js - MINIMAL WORKING VERSION
const axios = require('axios');

class AIResponseService {
  constructor() {
    this.url = 'http://localhost:11434/api/generate';
    this.model = process.env.OLLAMA_MODEL || 'phi';
    console.log(`[AI] Using model: ${this.model}`);
  }

  async generateResponse(context) {
    try {
      const { message, customerName, cart, orders, products } = context;

      // Build simple context
      let info = '';
      if (customerName && orders?.length) info = `Returning customer ${customerName}. `;
      if (cart?.itemCount) info += `Cart: ${cart.itemCount} items. `;
      if (products?.length) info += `Found ${products.length} items. `;
      
      const prompt = `[INST] You are FoodyBuddy food assistant. Reply in ONE sentence.
${info}
Customer: "${message}"
Reply: [/INST]`;

      console.log('[AI] Generating...');

      const res = await axios.post(
        this.url,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: { num_predict: 40 }
        },
        { timeout: 20000 }
      );

      const text = res.data.response?.trim().split('\n')[0];
      console.log('[AI] ✅', text);
      return text || this.getFallback(context);

    } catch (err) {
      console.log('[AI] ❌', err.message);
      return this.getFallback(context);
    }
  }

  getFallback(context) {
    const { intent, customerName, cart, orders, products } = context;
    
    if (intent === 'GREETING') {
      return customerName && orders?.length 
        ? `Welcome back, ${customerName}! 👋 What would you like?`
        : "Hi! Welcome to FoodyBuddy. 🍽️ What can I get for you?";
    }
    
    if (intent === 'VIEW_CART') {
      return cart?.items?.length 
        ? `You have ${cart.itemCount} items. Total: $${cart.total} 🛒`
        : "Your cart is empty. Browse our menu! 🍽️";
    }
    
    if (intent === 'ADD_TO_CART' && products?.length) {
      return `✅ Added ${products[0].name} to cart!`;
    }
    
    if (intent === 'ORDER_STATUS') {
      return orders?.length 
        ? `You have ${orders.length} orders! 📦`
        : "No orders yet. Place your first one? 🎯";
    }
    
    return "How can I help with your order? 🤖";
  }
}

module.exports = new AIResponseService();