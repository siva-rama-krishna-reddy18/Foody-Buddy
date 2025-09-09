// src/services/intentService.js
const DEBUG = process.env.NODE_ENV === 'development';

async function classifyIntent(message) {
  try {
    const lowerMessage = message.toLowerCase().trim();
    
    // Greeting patterns
    if (/^(hi|hello|hey|good morning|good evening|greetings)/.test(lowerMessage)) {
      return 'GREETING';
    }
    
    // Payment/Checkout patterns (check before other patterns)
    if (/\b(checkout|pay|payment|proceed.*pay|place.*order|complete.*order|pay.*now|make.*payment)\b/.test(lowerMessage)) {
      return 'CHECKOUT';
    }
    
    // Cart quantity update patterns (ADD THESE BEFORE OTHER PATTERNS)
    if (/\b(increase|decrease).*quantity/.test(lowerMessage)) {
      return 'UPDATE_CART_QUANTITY';
    }

    if (/\bremove.*from.*cart/.test(lowerMessage)) {
      return 'REMOVE_FROM_CART';
    }
    
    // Order tracking by ID patterns (check this before general order status)
    if (/\b(track|tracking|check|status|where.*is)\b.*\b(order|#)\s*\d+\b/.test(lowerMessage) ||
        /\border\s*\d+\b/.test(lowerMessage) ||
        /\b\d{3,}\b.*\b(order|status|track)\b/.test(lowerMessage)) {
      return 'TRACK_ORDER';
    }
    
    // Order status patterns (general history)
    if (/\b(order|orders|recent|history|status)\b/.test(lowerMessage) &&
        !/\b\d{3,}\b/.test(lowerMessage)) {
      return 'ORDER_STATUS';
    }
    
    // Add to cart patterns (VERY SPECIFIC)
    if (/\b(add\s+.+\s+to\s+cart|add\s+.+\s+cart|put\s+.+\s+in\s+cart)\b/.test(lowerMessage)) {
      return 'ADD_TO_CART';
    }
    
    // View cart patterns (VERY SPECIFIC)
    if (/^(show\s+my\s+cart|view\s+cart|see\s+cart|cart|my\s+cart)$/i.test(lowerMessage)) {
      return 'VIEW_CART';
    }
    
    // Explicit search patterns (VERY SPECIFIC)
    if (/^(search\s+for|find\s+me|do\s+you\s+have|show\s+me\s+menu|view\s+menu|menu)/.test(lowerMessage)) {
      return 'SEARCH';
    }
    
    // Explicit recommendation requests (VERY SPECIFIC)
    if (/^(recommend|what\s+do\s+you\s+recommend|suggest\s+something|what.*popular|what.*good)/.test(lowerMessage)) {
      return 'RECOMMEND';
    }
    
    // Preference learning patterns
    if (/\b(love|like|hate|prefer|favorite|favourite|don't like|dislike)\b/.test(lowerMessage)) {
      return 'LEARN_PREFERENCE';
    }
    
    // CONVERSATIONAL QUERIES - Let these go to AI
    // Hunger expressions
    if (/\b(hungry|starving|famished|want.*eat|need.*food|craving)\b/.test(lowerMessage)) {
      return 'UNKNOWN';
    }
    
    // Question words that indicate conversation
    if (/^(what|how|why|when|where|which|can\s+you|could\s+you|would\s+you|tell\s+me|explain)/.test(lowerMessage)) {
      return 'UNKNOWN';
    }
    // In intentService.js, add this to your intent patterns:
if (lowerText.includes('reorder') && /\b\d{3,}\b/.test(text)) {
  return 'REORDER';
}
    
    // Natural conversation starters
    if (/\b(help|assist|advice|suggestion|opinion|think|feel|good\s+for|best\s+for)\b/.test(lowerMessage)) {
      return 'UNKNOWN';
    }
    
    // Default to UNKNOWN for conversational AI
    return 'UNKNOWN';
    
  } catch (error) {
    console.error('[Intent] Classification error:', error);
    return 'UNKNOWN';
  }
}

function extractEntities(message) {
  const entities = {
    foods: [],
    quantities: [],
    preferences: [],
    orderId: null
  };
  
  const lowerMessage = message.toLowerCase();
  
  // Extract order ID
  const orderIdRegex = /\b(\d{3,})\b/;
  const orderIdMatch = message.match(orderIdRegex);
  if (orderIdMatch) {
    entities.orderId = orderIdMatch[1];
  }
  
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
  console.log('[Intent] Service loaded with cart controls and AI-friendly classification');
}

module.exports = {
  classifyIntent,
  extractEntities
};