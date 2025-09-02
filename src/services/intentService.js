// src/services/intentService.js
const DEBUG = process.env.NODE_ENV === 'development';

async function classifyIntent(message) {
  try {
    const lowerMessage = message.toLowerCase().trim();
    
    // Greeting patterns
    if (/^(hi|hello|hey|good morning|good evening|greetings)/.test(lowerMessage)) {
      return 'GREETING';
    }
    
    // Order status patterns
    if (/\b(order|orders|recent|history|status|tracking)\b/.test(lowerMessage)) {
      return 'ORDER_STATUS';
    }
    
    // Recommendation patterns  
    if (/\b(recommend|suggestion|suggest|what.*good|popular|best)\b/.test(lowerMessage)) {
      return 'RECOMMEND';
    }
    
    // Search patterns
    if (/\b(do you have|find|search|looking for|menu|available)\b/.test(lowerMessage)) {
      return 'SEARCH';
    }
    
    // Add to cart patterns
    if (/\b(add.*cart|want.*order|I.*like|get me)\b/.test(lowerMessage)) {
      return 'ADD_TO_CART';
    }
    
    // View cart patterns
    if (/\b(cart|basket|my order|show.*cart|view.*cart)\b/.test(lowerMessage)) {
      return 'VIEW_CART';
    }
    
    // Preference learning patterns
    if (/\b(love|like|hate|prefer|favorite|favourite|don't like|dislike)\b/.test(lowerMessage)) {
      return 'LEARN_PREFERENCE';
    }
    
    // Default to search for unknown queries
    return 'SEARCH';
    
  } catch (error) {
    console.error('[Intent] Classification error:', error);
    return 'UNKNOWN';
  }
}

function extractEntities(message) {
  const entities = {
    foods: [],
    quantities: [],
    preferences: []
  };
  
  const lowerMessage = message.toLowerCase();
  
  // Common food items
  const foods = ['biryani', 'curry', 'naan', 'samosa', 'rice', 'chicken', 'lamb', 'vegetable'];
  foods.forEach(food => {
    if (lowerMessage.includes(food)) {
      entities.foods.push(food);
    }
  });
  
  // Quantity extraction
  const quantityRegex = /(\d+)\s*(piece|pieces|pc|pcs|item|items)?/gi;
  const quantityMatches = message.match(quantityRegex);
  if (quantityMatches) {
    entities.quantities = quantityMatches;
  }
  
  // Preference words
  const preferences = ['spicy', 'mild', 'sweet', 'sour', 'vegetarian', 'vegan', 'halal'];
  preferences.forEach(pref => {
    if (lowerMessage.includes(pref)) {
      entities.preferences.push(pref);
    }
  });
  
  return entities;
}

if (DEBUG) {
  console.log('[Intent] Service loaded');
}

module.exports = {
  classifyIntent,
  extractEntities
};