// src/services/intentService.js
const DEBUG = process.env.NODE_ENV === 'development';

async function classifyIntent(message) {
  try {
    const lowerMessage = message.toLowerCase().trim();
    
    // FR01: Order Search by Number - HIGHEST PRIORITY
    if (/\b(order|#)\s*\d{4,}\b/i.test(message) || /\blook.*up.*order\b/i.test(lowerMessage)) {
      return 'TRACK_ORDER';
    }
    
    // FR02: Get Order Status
    if (/\b(status|track).*\border\b/i.test(lowerMessage) || 
        /\border.*\b(status|tracking)\b/i.test(lowerMessage)) {
      return 'ORDER_STATUS';
    }
    
    // FR03: Query Order Items
    if (/\b(what.*in|items.*in|products.*in|contents.*of).*\border\b/i.test(lowerMessage)) {
      return 'TRACK_ORDER';
    }
    
    // FR04: Verify Amount and Payment
    if (/\b(amount|paid|payment|cost|price|total).*\border\b/i.test(lowerMessage) ||
        /\border.*\b(amount|paid|payment|cost)\b/i.test(lowerMessage)) {
      return 'TRACK_ORDER';
    }
    
    // FR05: Get Special Instructions
    if (/\b(special.*instruction|instruction|note|request).*\border\b/i.test(lowerMessage) ||
        /\border.*\b(instruction|note|special)\b/i.test(lowerMessage)) {
      return 'GET_SPECIAL_INSTRUCTIONS';
    }
    
    // FR06: Query Customer Information
    if (/\b(customer.*info|email|phone|address).*\border\b/i.test(lowerMessage) ||
        /\bget.*\b(email|phone|contact|address)\b/i.test(lowerMessage)) {
      return 'GET_CUSTOMER_INFO';
    }
    
    // FR07: Verify Coupon Usage
    if (/\b(coupon|discount|promo).*\b(used|applied)\b/i.test(lowerMessage) ||
        /\bwas.*coupon.*used\b/i.test(lowerMessage)) {
      return 'VERIFY_COUPON_USAGE';
    }
    
    // FR08: Search by Customer Data
    if (/@/.test(message) || /\+?\d{10,}/.test(message) ||
        /\bfind.*order.*for\b/i.test(lowerMessage) ||
        /\blast.*order.*for\b/i.test(lowerMessage)) {
      return 'SEARCH_BY_CUSTOMER';
    }
    
    // Greeting patterns
    if (/^(hi|hello|hey|good morning|good evening|greetings)\b/i.test(lowerMessage)) {
      return 'GREETING';
    }
    
     if (/\b(today.*special|special.*today|show.*special|today'?s?\s+special)\b/i.test(lowerMessage) ||
        lowerMessage === "today's specials" ||
        lowerMessage === 'todays specials') {
      return 'RECOMMEND';
    }
    // Payment/Checkout patterns
    if (/\b(checkout|pay|payment|proceed.*pay|place.*order|complete.*order)\b/i.test(lowerMessage)) {
      return 'CHECKOUT';
    }
    
    // Payment success
    if (/\b(payment.*completed|payment.*successful|payment.*success|order.*placed)\b/i.test(lowerMessage)) {
      return 'PAYMENT_SUCCESS';
    }
    
    // Cart patterns
    if (/\b(add.*to.*cart|put.*in.*cart)\b/i.test(lowerMessage)) {
      return 'ADD_TO_CART';
    }
    
    if (/^(show.*cart|view.*cart|see.*cart|my.*cart|cart)$/i.test(lowerMessage)) {
      return 'VIEW_CART';
    }
    
    if (/\bremove.*from.*cart\b/i.test(lowerMessage)) {
      return 'REMOVE_FROM_CART';
    }
    
    if (/^(clear.*cart|empty.*cart|remove.*all)$/i.test(lowerMessage)) {
      return 'CLEAR_CART';
    }
    
    if (/\b(increase|decrease).*quantity\b/i.test(lowerMessage)) {
      return 'UPDATE_CART_QUANTITY';
    }
    
    // Menu and recommendations
    if (/\b(menu|special|recommend|suggest|popular)\b/i.test(lowerMessage)) {
      return 'RECOMMEND';
    }
    
    // Search patterns
    if (/^(search|find|show|get|view|see)\b/i.test(lowerMessage) ||
        /\b(chicken|rice|biryani|curry|soup|food|dish)\b/i.test(lowerMessage)) {
      return 'SEARCH';
    }
    
    // Preference learning
    if (/\b(love|like|hate|prefer|favorite|favourite|dislike)\b/i.test(lowerMessage)) {
      return 'LEARN_PREFERENCE';
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
    orderId: null,
    email: null,
    phone: null
  };
  
  const lowerMessage = message.toLowerCase();
  
  // Extract order ID
  const orderIdMatch = message.match(/\b(\d{4,})\b/);
  if (orderIdMatch) {
    entities.orderId = orderIdMatch[1];
  }
  
  // Extract email
  const emailMatch = message.match(/\b[\w.-]+@[\w.-]+\.\w+\b/);
  if (emailMatch) {
    entities.email = emailMatch[0];
  }
  
  // Extract phone
  const phoneMatch = message.match(/\+?\d{10,}/);
  if (phoneMatch) {
    entities.phone = phoneMatch[0];
  }
  
  // Common food items
  const foods = ['biryani', 'curry', 'naan', 'samosa', 'rice', 'chicken', 'lamb', 'vegetable', 'soup', 'fried'];
  foods.forEach(food => {
    if (lowerMessage.includes(food)) {
      entities.foods.push(food);
    }
  });
  
  // Quantity extraction
  const quantityMatch = message.match(/(\d+)\s*(piece|pieces|pc|pcs|item|items|x)?/gi);
  if (quantityMatch) {
    entities.quantities = quantityMatch;
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
  console.log('[Intent] Service loaded with ALL features enabled');
}

module.exports = {
  classifyIntent,
  extractEntities
};