// src/services/intentService.js
const DEBUG = process.env.NODE_ENV === 'development';

async function classifyIntent(message) {
  try {
    const lowerMessage = message.toLowerCase().trim();
    
    // Greeting patterns
    if (/^(hi|hello|hey|good morning|good evening|greetings)/.test(lowerMessage)) {
      return 'GREETING';
    }
    
    // Fix the coupon verification pattern - make it more specific
if (/\b(was.*coupon.*used|coupon.*used|any.*coupon.*used|check.*coupon.*usage)\b.*\b(order|#)\s*\d+\b/.test(lowerMessage) ||
    /\b(order|#)\s*\d+\b.*\b(coupon.*used|used.*coupon)\b/.test(lowerMessage)) {
  return 'VERIFY_COUPON_USAGE';
}

// Keep the general coupon pattern AFTER the specific one
if (/\b(coupon|coupons|discount|discounts|promo|promo code|offer|offers|deal|deals)\b/.test(lowerMessage)) {
  return 'VIEW_COUPONS';

}

// Make the payment success pattern more flexible
if (/\b(payment.*completed|payment.*successful|payment.*success|order.*placed|payment.*done)\b/.test(lowerMessage)) {
  return 'PAYMENT_SUCCESS';
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
    
    // Customer Information Query patterns - MOST SPECIFIC FIRST
/*if (/\b(give me|get|what.*is|tell me|show me)\b.*\b(email|phone|address|customer.*info|contact.*info|customer.*details)\b.*\b(order|#)\s*\d+\b/.test(lowerMessage) ||
    /\b(email|phone|address|customer.*info|contact.*info|customer.*details)\b.*\b(order|#)\s*\d+\b/.test(lowerMessage)) {
  return 'GET_CUSTOMER_INFO';
}
*/

// Coupon verification patterns - SPECIFIC
if (/\b(was.*coupon|coupon.*used|any.*coupon|check.*coupon)\b.*\b(order|#)\s*\d+\b/.test(lowerMessage) ||
    /\b(order|#)\s*\d+\b.*\b(coupon|discount)\b/.test(lowerMessage)) {
  return 'VERIFY_COUPON_USAGE';
}


// Customer search patterns - SPECIFIC
if (/\b(find.*order.*for|latest.*order.*for|search.*orders.*for|search.*customer)\b/.test(lowerMessage) ||
    /@/.test(lowerMessage) ||
    /\+?\d{10,}/.test(lowerMessage)) { // Phone number pattern
  return 'SEARCH_BY_CUSTOMER';
}

// Provisional order patterns - SPECIFIC
if (/\b(provisional.*order|temp.*order)\b/.test(lowerMessage)) {
  return 'TRACK_PROVISIONAL_ORDER';
}

if (/\b(any.*special.*instruction|special.*instruction|instruction.*for.*order|special.*request|note.*for.*order)\b/.test(lowerMessage)) {
  return 'GET_SPECIAL_INSTRUCTIONS';
}

// GENERAL ORDER TRACKING (place AFTER specific patterns)
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

    // Add this pattern with your other cart patterns
if (/^(clear\s+cart|empty\s+cart|remove\s+all|clear\s+my\s+cart)$/i.test(lowerMessage)) {
  return 'CLEAR_CART';
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
    if (lowerMessage.includes('reorder') && /\b\d{3,}\b/.test(message)) {
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
  console.log('[Intent] Service loaded with cart controls, coupon recognition, and AI-friendly classification');
}

module.exports = {
  classifyIntent,
  extractEntities
};